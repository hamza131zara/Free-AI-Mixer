import type {
  ExportFailure,
  ExportRenderSettings,
} from "../../src/types/exportJob";
import type {
  BackendArtifactMetadata,
  BackendArtifactStatus,
  BackendExportJobRecord,
  BackendExportLifecycleStatus,
  BackendExportJobOwnerScope,
} from "../contracts/exportHttpTypes";
import type {
  CreateExportJobInput,
  ExportJobClaimOptions,
  ExportJobRegistry,
  ExportJobTransitionOptions,
} from "./exportJobRegistry";
import { ExportJobTransitionError } from "./exportJobRegistry";

type TransitionMap = Record<
  BackendExportLifecycleStatus,
  ReadonlySet<BackendExportLifecycleStatus>
>;

const allowedTransitions: TransitionMap = {
  queued: new Set(),
  submitted: new Set(["rendering", "error", "expired"]),
  rendering: new Set(["finalizing", "error", "expired"]),
  finalizing: new Set(["success", "error", "expired"]),
  success: new Set(),
  error: new Set(),
  expired: new Set(),
};

const allowedArtifactStatuses: ReadonlySet<BackendArtifactStatus> = new Set([
  "unavailable",
  "pending_verification",
  "available",
  "expired",
  "failed",
]);

const validateFailure = (failure: ExportFailure | undefined): ExportFailure => {
  if (!failure || typeof failure.message !== "string" || failure.message.trim().length === 0) {
    throw new ExportJobTransitionError(
      "Transition to 'error' requires a valid failure message.",
    );
  }

  return failure;
};

const validateSuccessArtifacts = (
  jobId: string,
  artifacts: unknown[] | undefined,
): BackendArtifactMetadata[] => {
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    throw new ExportJobTransitionError(
      "Transition to 'success' requires at least one verified artifact.",
    );
  }

  return artifacts.map((artifact) => validateArtifactMetadata(jobId, artifact));
};

const validateArtifactMetadata = (
  jobId: string,
  artifact: unknown,
): BackendArtifactMetadata => {
  if (typeof artifact !== "object" || artifact === null) {
    throw new ExportJobTransitionError("Artifact metadata must be an object.");
  }

  const candidate = artifact as Record<string, unknown>;
  rejectUnsafeArtifactFields(candidate);

  if (!("artifactId" in candidate) && "id" in candidate) {
    const legacyArtifactId = readNonEmptyString(candidate.id, "id");
    return {
      artifactId: legacyArtifactId,
      jobId,
      kind: "render_output",
      format: "unknown",
      status: "available",
      createdAt: new Date().toISOString(),
    };
  }

  const artifactId = readNonEmptyString(candidate.artifactId, "artifactId");
  const artifactJobId = readNonEmptyString(candidate.jobId, "jobId");
  if (artifactJobId !== jobId) {
    throw new ExportJobTransitionError(
      `Artifact jobId '${artifactJobId}' does not match export job '${jobId}'.`,
    );
  }

  const kind = readNonEmptyString(candidate.kind, "kind");
  const format = readNonEmptyString(candidate.format, "format");
  const status = readArtifactStatus(candidate.status);
  const createdAt = readNonEmptyString(candidate.createdAt, "createdAt");

  const sizeBytes = readOptionalNonNegativeNumber(candidate.sizeBytes, "sizeBytes");
  const durationMs = readOptionalNonNegativeNumber(candidate.durationMs, "durationMs");

  return {
    artifactId,
    jobId: artifactJobId,
    kind,
    format,
    status,
    createdAt,
    ...(sizeBytes === undefined ? {} : { sizeBytes }),
    ...(durationMs === undefined ? {} : { durationMs }),
  };
};

const rejectUnsafeArtifactFields = (candidate: Record<string, unknown>): void => {
  const blockedKeys = ["path", "filePath", "localPath", "url", "downloadUrl"];
  for (const key of blockedKeys) {
    if (key in candidate) {
      throw new ExportJobTransitionError(
        `Artifact field '${key}' is not allowed in this phase.`,
      );
    }
  }
};

const readNonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ExportJobTransitionError(
      `Artifact metadata field '${field}' must be a non-empty string.`,
    );
  }

  return value;
};

const readArtifactStatus = (value: unknown): BackendArtifactStatus => {
  if (typeof value !== "string" || !allowedArtifactStatuses.has(value as BackendArtifactStatus)) {
    throw new ExportJobTransitionError("Artifact metadata field 'status' is invalid.");
  }

  return value as BackendArtifactStatus;
};

const readOptionalNonNegativeNumber = (
  value: unknown,
  field: string,
): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new ExportJobTransitionError(
      `Artifact metadata field '${field}' must be a non-negative number when provided.`,
    );
  }

  return value;
};

const readWorkerId = (workerId: string): string => {
  if (typeof workerId !== "string" || workerId.trim().length === 0) {
    throw new ExportJobTransitionError("Worker id must be a non-empty string.");
  }

  return workerId;
};

const isTerminalStatus = (status: BackendExportLifecycleStatus): boolean =>
  status === "success" || status === "error" || status === "expired";

const isClaimActive = (record: BackendExportJobRecord): boolean => {
  if (!record.claimedByWorkerId) {
    return false;
  }

  if (!record.claimExpiresAt) {
    return true;
  }

  return Date.now() < Date.parse(record.claimExpiresAt);
};

const assertClaimable = (record: BackendExportJobRecord): void => {
  if (isTerminalStatus(record.status)) {
    throw new ExportJobTransitionError(
      `Export job '${record.jobId}' is terminal and cannot be claimed.`,
    );
  }
};

export const canTransition = (
  from: BackendExportLifecycleStatus,
  to: BackendExportLifecycleStatus,
): boolean => allowedTransitions[from].has(to);

const createJobId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const defaultOwnerScope: BackendExportJobOwnerScope = {
  ownerId: "local-dev-owner",
  workspaceId: "local-dev-workspace",
};

const resolveOwnerScope = (
  scope?: Partial<BackendExportJobOwnerScope>,
): BackendExportJobOwnerScope => ({
  ownerId:
    typeof scope?.ownerId === "string" && scope.ownerId.trim().length > 0
      ? scope.ownerId
      : defaultOwnerScope.ownerId,
  workspaceId:
    typeof scope?.workspaceId === "string" && scope.workspaceId.trim().length > 0
      ? scope.workspaceId
      : defaultOwnerScope.workspaceId,
});

const toRequestScopeKey = (
  requestId: string,
  scope?: Partial<BackendExportJobOwnerScope>,
): string => {
  const resolved = resolveOwnerScope(scope);
  return `${resolved.ownerId}::${resolved.workspaceId}::${requestId}`;
};

const normalizeSeededRecord = (
  record: BackendExportJobRecord,
): BackendExportJobRecord => {
  const ownerScope = resolveOwnerScope(record);
  return {
    ...record,
    ownerId: ownerScope.ownerId,
    workspaceId: ownerScope.workspaceId,
  };
};

export interface InMemoryExportJobRegistrySeed {
  jobs?: BackendExportJobRecord[];
  requestIdToJobId?: Record<string, string>;
}

export interface InMemoryExportJobRegistryOptions {
  seed?: InMemoryExportJobRegistrySeed;
}

export class InMemoryExportJobRegistry implements ExportJobRegistry {
  private readonly jobsById = new Map<string, BackendExportJobRecord>();
  private readonly jobIdByRequestId = new Map<string, string>();

  constructor(options?: InMemoryExportJobRegistryOptions) {
    if (options?.seed) {
      const { jobs, requestIdToJobId } = options.seed;
      if (jobs) {
        for (const seededRecord of jobs) {
          const record = normalizeSeededRecord(seededRecord);
          this.jobsById.set(record.jobId, record);
          // Only seed requestId mapping for non-terminal jobs
          if (!isTerminalStatus(record.status)) {
            this.jobIdByRequestId.set(
              toRequestScopeKey(record.requestId, record),
              record.jobId,
            );
          }
        }
      }
      if (requestIdToJobId) {
        for (const [requestId, jobId] of Object.entries(requestIdToJobId)) {
          // Only seed if job exists and is non-terminal
          const job = this.jobsById.get(jobId);
          if (job && !isTerminalStatus(job.status)) {
            this.jobIdByRequestId.set(
              toRequestScopeKey(requestId, job),
              jobId,
            );
          }
        }
      }
    }
  }

  async create(input: CreateExportJobInput): Promise<BackendExportJobRecord> {
    const now = new Date().toISOString();
    const jobId = createJobId();
    const status: BackendExportLifecycleStatus = "submitted";
    const ownerScope = resolveOwnerScope(input);

    const record: BackendExportJobRecord = {
      jobId,
      requestId: input.requestId,
      timelineId: input.timelineId,
      ownerId: ownerScope.ownerId,
      workspaceId: ownerScope.workspaceId,
      status,
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
      renderSettings: input.renderSettings,
    };

    this.jobsById.set(jobId, record);
    this.jobIdByRequestId.set(
      toRequestScopeKey(record.requestId, ownerScope),
      record.jobId,
    );
    return record;
  }

  async getById(jobId: string): Promise<BackendExportJobRecord | undefined> {
    return this.jobsById.get(jobId);
  }

  async getByIdForOwner(
    jobId: string,
    ownerScope: BackendExportJobOwnerScope,
  ): Promise<BackendExportJobRecord | undefined> {
    const record = this.jobsById.get(jobId);
    if (!record) {
      return undefined;
    }

    const resolvedOwnerScope = resolveOwnerScope(ownerScope);
    return record.ownerId === resolvedOwnerScope.ownerId &&
        record.workspaceId === resolvedOwnerScope.workspaceId
      ? record
      : undefined;
  }

  async getByRequestId(
    requestId: string,
    ownerScope?: BackendExportJobOwnerScope,
  ): Promise<BackendExportJobRecord | undefined> {
    const existingJobId = this.jobIdByRequestId.get(
      toRequestScopeKey(requestId, ownerScope),
    );
    if (!existingJobId) {
      return undefined;
    }

    return this.jobsById.get(existingJobId);
  }

  async getByStatus(
    status: BackendExportLifecycleStatus,
  ): Promise<BackendExportJobRecord[]> {
    return Array.from(this.jobsById.values()).filter(
      (job) => job.status === status,
    );
  }

  async claim(
    jobId: string,
    workerId: string,
    options?: ExportJobClaimOptions,
  ): Promise<BackendExportJobRecord> {
    const existing = this.requireExistingJob(jobId);
    const normalizedWorkerId = readWorkerId(workerId);
    assertClaimable(existing);

    const now = new Date().toISOString();
    const existingClaimActive = isClaimActive(existing);
    if (
      existingClaimActive &&
      existing.claimedByWorkerId &&
      existing.claimedByWorkerId !== normalizedWorkerId
    ) {
      throw new ExportJobTransitionError(
        `Export job '${jobId}' is already claimed by another worker.`,
      );
    }

    const nextRecord: BackendExportJobRecord = {
      ...existing,
      claimedByWorkerId: normalizedWorkerId,
      attemptCount: existing.attemptCount + 1,
      updatedAt: now,
      ...(existing.startedAt ? {} : { startedAt: now }),
      ...(options?.claimTtlMs && options.claimTtlMs > 0
        ? { claimExpiresAt: new Date(Date.now() + options.claimTtlMs).toISOString() }
        : {}),
    };

    this.jobsById.set(jobId, nextRecord);
    return nextRecord;
  }

  async markRendering(
    jobId: string,
    workerId: string,
  ): Promise<BackendExportJobRecord> {
    this.assertWorkerOwnsClaim(jobId, workerId);
    return this.transition(jobId, "rendering");
  }

  async markFinalizing(
    jobId: string,
    workerId: string,
  ): Promise<BackendExportJobRecord> {
    this.assertWorkerOwnsClaim(jobId, workerId);
    return this.transition(jobId, "finalizing");
  }

  async markSuccess(
    jobId: string,
    workerId: string,
    artifacts: unknown[],
  ): Promise<BackendExportJobRecord> {
    this.assertWorkerOwnsClaim(jobId, workerId);
    return this.transition(jobId, "success", { artifacts });
  }

  async markError(
    jobId: string,
    workerId: string,
    failure: ExportFailure,
  ): Promise<BackendExportJobRecord> {
    this.assertWorkerOwnsClaim(jobId, workerId);
    return this.transition(jobId, "error", { failure });
  }

  async transition(
    jobId: string,
    nextStatus: BackendExportLifecycleStatus,
    options?: ExportJobTransitionOptions,
  ): Promise<BackendExportJobRecord> {
    const existing = this.jobsById.get(jobId);
    if (!existing) {
      throw new ExportJobTransitionError(`Export job '${jobId}' was not found.`);
    }

    if (!canTransition(existing.status, nextStatus)) {
      throw new ExportJobTransitionError(
        `Transition '${existing.status}' -> '${nextStatus}' is not allowed.`,
      );
    }

    if (nextStatus === "success") {
      const artifacts = validateSuccessArtifacts(jobId, options?.artifacts);
      const now = new Date().toISOString();
      const nextRecord: BackendExportJobRecord = {
        ...existing,
        status: "success",
        artifacts,
        failure: undefined,
        completedAt: now,
        updatedAt: now,
      };
      this.jobsById.set(jobId, nextRecord);
      return nextRecord;
    }

    if (nextStatus === "error") {
      const failure = validateFailure(options?.failure);
      const now = new Date().toISOString();
      const nextRecord: BackendExportJobRecord = {
        ...existing,
        status: "error",
        failure,
        completedAt: now,
        updatedAt: now,
      };
      this.jobsById.set(jobId, nextRecord);
      return nextRecord;
    }

    if (nextStatus === "expired") {
      const now = new Date().toISOString();
      const nextRecord: BackendExportJobRecord = {
        ...existing,
        status: "expired",
        expiredAt: now,
        completedAt: now,
        updatedAt: now,
      };
      this.jobsById.set(jobId, nextRecord);
      return nextRecord;
    }

    const now = new Date().toISOString();
    const nextRecord: BackendExportJobRecord = {
      ...existing,
      status: nextStatus,
      updatedAt: now,
      ...(nextStatus === "rendering" ? { renderingAt: now } : {}),
      ...(nextStatus === "finalizing" ? { finalizingAt: now } : {}),
    };
    this.jobsById.set(jobId, nextRecord);
    return nextRecord;
  }

  private assertWorkerOwnsClaim(jobId: string, workerId: string): void {
    const existing = this.requireExistingJob(jobId);
    const normalizedWorkerId = readWorkerId(workerId);

    if (isTerminalStatus(existing.status)) {
      throw new ExportJobTransitionError(
        `Export job '${jobId}' is terminal and cannot be updated by a worker.`,
      );
    }

    if (!existing.claimedByWorkerId || !isClaimActive(existing)) {
      throw new ExportJobTransitionError(
        `Export job '${jobId}' is not actively claimed by any worker.`,
      );
    }

    if (existing.claimedByWorkerId !== normalizedWorkerId) {
      throw new ExportJobTransitionError(
        `Worker '${normalizedWorkerId}' does not own export job '${jobId}'.`,
      );
    }
  }

  private requireExistingJob(jobId: string): BackendExportJobRecord {
    const existing = this.jobsById.get(jobId);
    if (!existing) {
      throw new ExportJobTransitionError(`Export job '${jobId}' was not found.`);
    }

    return existing;
  }

  /**
   * Snapshot current registry state for persistence.
   * Returns jobs and requestId mapping for serialization.
   */
  toSnapshot(): { jobs: BackendExportJobRecord[]; requestIdToJobId: Record<string, string> } {
    return {
      jobs: Array.from(this.jobsById.values()),
      requestIdToJobId: Object.fromEntries(this.jobIdByRequestId),
    };
  }
}

export { validateArtifactMetadata };
