import type {
  ExportFailure,
  ExportRenderSettings,
} from "../../src/types/exportJob";
import type {
  BackendArtifactMetadata,
  BackendExportJobRecord,
  BackendExportLifecycleStatus,
  BackendExportJobOwnerScope,
} from "../contracts/exportHttpTypes";

export interface CreateExportJobInput {
  requestId: string;
  timelineId: string;
  renderSettings: ExportRenderSettings;
  ownerId?: string;
  workspaceId?: string;
}

export interface ExportJobRegistry {
  create(input: CreateExportJobInput): Promise<BackendExportJobRecord>;
  getById(jobId: string): Promise<BackendExportJobRecord | undefined>;
  getByIdForOwner(
    jobId: string,
    ownerScope: BackendExportJobOwnerScope,
  ): Promise<BackendExportJobRecord | undefined>;
  getByRequestId(
    requestId: string,
    ownerScope?: BackendExportJobOwnerScope,
  ): Promise<BackendExportJobRecord | undefined>;
  getByStatus(status: BackendExportLifecycleStatus): Promise<BackendExportJobRecord[]>;
  claim(
    jobId: string,
    workerId: string,
    options?: ExportJobClaimOptions,
  ): Promise<BackendExportJobRecord>;
  markRendering(jobId: string, workerId: string): Promise<BackendExportJobRecord>;
  markFinalizing(jobId: string, workerId: string): Promise<BackendExportJobRecord>;
  markSuccess(
    jobId: string,
    workerId: string,
    artifacts: unknown[],
  ): Promise<BackendExportJobRecord>;
  markError(
    jobId: string,
    workerId: string,
    failure: ExportFailure,
  ): Promise<BackendExportJobRecord>;
  transition(
    jobId: string,
    nextStatus: BackendExportLifecycleStatus,
    options?: ExportJobTransitionOptions,
  ): Promise<BackendExportJobRecord>;
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
export type { BackendExportJobOwnerScope };

// Re-export validateArtifactMetadata from implementation for external use
export { validateArtifactMetadata } from "./inMemoryExportJobRegistry";

// Re-export InMemoryExportJobRegistry for backwards compatibility
export { InMemoryExportJobRegistry } from "./inMemoryExportJobRegistry";

// Re-export canTransition for backwards compatibility
export { canTransition } from "./inMemoryExportJobRegistry";
