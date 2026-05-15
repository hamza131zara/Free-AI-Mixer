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

export type ExportPollResponseBody = ExportPollResult;

export interface ExportArtifactsUnavailableResponseBody {
  code: "export_artifacts_unavailable";
  message: string;
  details?: {
    jobId: string;
  };
}

/**
 * Safe artifact access descriptor for future downloadable artifact access.
 *
 * IMPORTANT SAFETY RULES:
 * - url field must only be backend-issued.
 * - It must never be a local filesystem path.
 * - It must never be frontend-generated.
 * - For signed_url mode, it must be signed/expiring.
 * - For backend_stream/local_dev_stream, it should be a backend route URL, not a file path.
 */
export type BackendArtifactAccessKind =
  | "signed_url"
  | "backend_stream"
  | "local_dev_stream";

export interface BackendArtifactAccessDescriptor {
  kind: BackendArtifactAccessKind;
  artifactId: string;
  jobId: string;
  /** Backend-issued URL only. Must not be local filesystem path or frontend-generated. */
  url?: string;
  method?: "GET";
  /** ISO timestamp when access expires (for signed_url mode). */
  expiresAt?: string;
  contentType?: string;
  fileName?: string;
  sizeBytes?: number;
}

export interface BackendArtifactAccessReadyResponse {
  kind: "artifact_access_ready";
  artifact: BackendArtifactMetadata;
  access: BackendArtifactAccessDescriptor;
}

export type BackendArtifactAccessUnavailableReason =
  | "job_not_found"
  | "job_not_successful"
  | "artifact_not_found"
  | "artifact_not_ready"
  | "artifact_expired"
  | "artifact_access_not_configured";

export interface BackendArtifactAccessUnavailableResponse {
  kind: "artifact_access_unavailable";
  reason: BackendArtifactAccessUnavailableReason;
  message: string;
}

export type BackendArtifactAccessResponse =
  | BackendArtifactAccessReadyResponse
  | BackendArtifactAccessUnavailableResponse;

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
