import type {
  ExportFailure,
  ExportRenderSettings,
} from "../../src/types/exportJob";
import type {
  BackendArtifactMetadata,
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
  getByStatus(status: BackendExportLifecycleStatus): BackendExportJobRecord[];
  claim(
    jobId: string,
    workerId: string,
    options?: ExportJobClaimOptions,
  ): BackendExportJobRecord;
  markRendering(jobId: string, workerId: string): BackendExportJobRecord;
  markFinalizing(jobId: string, workerId: string): BackendExportJobRecord;
  markSuccess(
    jobId: string,
    workerId: string,
    artifacts: unknown[],
  ): BackendExportJobRecord;
  markError(
    jobId: string,
    workerId: string,
    failure: ExportFailure,
  ): BackendExportJobRecord;
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

export interface ExportJobClaimOptions {
  claimTtlMs?: number;
}

export class ExportJobTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportJobTransitionError";
  }
}

export type { BackendArtifactMetadata };

// Re-export validateArtifactMetadata from implementation for external use
export { validateArtifactMetadata } from "./inMemoryExportJobRegistry";

// Re-export InMemoryExportJobRegistry for backwards compatibility
export { InMemoryExportJobRegistry } from "./inMemoryExportJobRegistry";

// Re-export canTransition for backwards compatibility
export { canTransition } from "./inMemoryExportJobRegistry";