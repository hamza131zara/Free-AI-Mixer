import type {
  ExportArtifactRef,
  ExportFailure,
  ExportRenderSettings,
} from "../../src/types/exportJob";
import type {
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
  artifacts?: ExportArtifactRef[];
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
      const artifacts = validateSuccessArtifacts(options?.artifacts);
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
  artifacts: ExportArtifactRef[] | undefined,
): ExportArtifactRef[] => {
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    throw new ExportJobTransitionError(
      "Transition to 'success' requires at least one verified artifact.",
    );
  }

  for (const artifact of artifacts) {
    if (!artifact || typeof artifact.id !== "string" || artifact.id.trim().length === 0) {
      throw new ExportJobTransitionError("Artifact metadata must include a non-empty id.");
    }

    if (typeof artifact.url === "string" && artifact.url.trim().length > 0) {
      throw new ExportJobTransitionError(
        "Artifact URLs are not allowed in this phase.",
      );
    }
  }

  return artifacts;
};

const createJobId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
