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

export interface BackendExportJobRecord {
  jobId: string;
  requestId: string;
  timelineId: string;
  status: BackendExportInFlightStatus;
  createdAt: string;
  updatedAt: string;
  renderSettings: ExportRenderSettings;
  failure?: ExportFailure;
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
  status: record.status === "queued" ? "submitted" : record.status,
  submittedAt: record.createdAt,
});
