import type {
  ExportFailure,
  ExportJobHandle,
  ExportJobStatus,
  ExportPollResult,
  ExportRenderSettings,
  ExportSubmissionResult,
  TimelineExportRequest,
} from "../../src/types/exportJob";

export type BackendExportInFlightStatus = Extract<
  ExportJobStatus,
  "queued" | "submitted" | "rendering" | "finalizing"
>;

export type BackendExportTerminalStatus = Extract<
  ExportJobStatus,
  "success" | "error" | "expired"
>;

export type BackendExportLifecycleStatus =
  | BackendExportInFlightStatus
  | BackendExportTerminalStatus;

export type BackendArtifactStatus =
  | "unavailable"
  | "pending_verification"
  | "available"
  | "expired"
  | "failed";

export interface BackendArtifactMetadata {
  artifactId: string;
  jobId: string;
  kind: string;
  format: string;
  status: BackendArtifactStatus;
  createdAt: string;
  sizeBytes?: number;
  durationMs?: number;
}

export interface BackendExportJobRecord {
  jobId: string;
  requestId: string;
  timelineId: string;
  status: BackendExportLifecycleStatus;
  attemptCount: number;
  claimedByWorkerId?: string;
  claimExpiresAt?: string;
  startedAt?: string;
  createdAt: string;
  updatedAt: string;
  renderSettings: ExportRenderSettings;
  failure?: ExportFailure;
  artifacts?: BackendArtifactMetadata[];
  completedAt?: string;
  renderingAt?: string;
  finalizingAt?: string;
  expiredAt?: string;
}

export type ExportSubmitRequestBody = TimelineExportRequest;

export type ExportSubmitResponseBody = ExportSubmissionResult;

export type ExportPollResponseBody = Extract<ExportPollResult, { kind: "pending" }>;

export interface ExportArtifactsUnavailableResponseBody {
  code: "export_artifacts_unavailable";
  message: string;
  details?: {
    jobId: string;
  };
}

export const toJobHandle = (
  record: BackendExportJobRecord,
): ExportJobHandle => ({
  provider: "backend_render",
  requestId: record.requestId,
  jobId: record.jobId,
  status:
    record.status === "rendering" || record.status === "finalizing"
      ? record.status
      : "submitted",
  submittedAt: record.createdAt,
});
