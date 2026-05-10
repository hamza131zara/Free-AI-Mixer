import type {
  ExportFailure,
  ExportRenderSettings,
} from "../../src/types/exportJob";
import type {
  BackendArtifactMetadata,
  BackendArtifactStatus,
  BackendExportJobRecord,
  BackendExportLifecycleStatus,
} from "../contracts/exportHttpTypes";

export interface CreateExportJobInput {
  requestId: string;
  timelineId: string;
  renderSettings: ExportRenderSettings;
}

export interface ExportJobRegistry {
  create(input: CreateExportJobInput): BackendExportJobRecord;
  getById(jobId: string): BackendExportJobRecord | undefined;
  getByRequestId(requestId: string): BackendExportJobRecord | undefined;
  transition(
    jobId: string,
    nextStatus: BackendExportLifecycleStatus,
    options?: ExportJobTransitionOptions,
  ): BackendExportJobRecord;
}

export interface ExportJobTransitionOptions {
  failure?: ExportFailure;
  artifacts?: unknown[];
}

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

export const canTransition = (
  from: BackendExportLifecycleStatus,
  to: BackendExportLifecycleStatus,
): boolean => allowedTransitions[from].has(to);

export class ExportJobTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportJobTransitionError";
  }
}

export class InMemoryExportJobRegistry implements ExportJobRegistry {
  private readonly jobsById = new Map<string, BackendExportJobRecord>();
  private readonly jobIdByRequestId = new Map<string, string>();

  create(input: CreateExportJobInput): BackendExportJobRecord {
    const now = new Date().toISOString();
    const jobId = createJobId();
    const status: BackendExportLifecycleStatus = "submitted";

    const record: BackendExportJobRecord = {
      jobId,
      requestId: input.requestId,
      timelineId: input.timelineId,
      status,
      createdAt: now,
      updatedAt: now,
      renderSettings: input.renderSettings,
    };

    this.jobsById.set(jobId, record);
    this.jobIdByRequestId.set(record.requestId, record.jobId);
    return record;
  }

  getById(jobId: string): BackendExportJobRecord | undefined {
    return this.jobsById.get(jobId);
  }

  getByRequestId(requestId: string): BackendExportJobRecord | undefined {
    const existingJobId = this.jobIdByRequestId.get(requestId);
    if (!existingJobId) {
      return undefined;
    }

    return this.jobsById.get(existingJobId);
  }

  transition(
    jobId: string,
    nextStatus: BackendExportLifecycleStatus,
    options?: ExportJobTransitionOptions,
  ): BackendExportJobRecord {
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
}

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

export const validateArtifactMetadata = (
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

const createJobId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
