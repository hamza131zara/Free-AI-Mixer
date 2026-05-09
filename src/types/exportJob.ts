import type { TimelineId } from "./timeline";

// Phase 5.1A contract types only.
// No export implementation exists yet.
// Backend rendering is deferred.
// Render queue/workers/webhooks are deferred.
// Store must not persist raw media blobs.
// Frontend must not fake export completion, artifacts, cancellation, or progress.

export type ExportJobId = string;
export type ExportRequestId = string;

export type ExportProvider = "backend_render";

export type ExportJobStatus =
  | "idle"
  | "queued"
  | "submitted"
  | "rendering"
  | "finalizing"
  | "success"
  | "error"
  | "canceled"
  | "expired";

export interface ExportArtifactRef {
  id: string;
  url?: string;
  status?: "pending" | "ready" | "expired" | "unavailable";
  contentType?: string;
  fileName?: string;
  bytes?: number;
  expiresAt?: string;
  metadata?: unknown;
}

export interface ExportFailure {
  message: string;
  code?: string;
  details?: unknown;
}

// Coarse stage text only. Do not fabricate percentage values.
// Percent may be present only when explicitly provided by backend telemetry.
export interface ExportProgressSnapshot {
  stage: string;
  statusMessage?: string;
  percent?: number;
  updatedAt?: string;
}

export interface ExportRenderSettings {
  format: "mp4" | "webm";
  resolution: "720p" | "1080p" | "1440p" | "2160p";
  fps: 24 | 30 | 60;
  quality: "draft" | "standard" | "high";
}

export interface ExportJobHandle {
  provider: ExportProvider;
  requestId: ExportRequestId;
  jobId: ExportJobId;
  status: Extract<ExportJobStatus, "submitted" | "rendering" | "finalizing">;
  submittedAt?: string;
  timeoutAt?: string;
  metadata?: unknown;
}

export interface ExportTerminalResult {
  provider: ExportProvider;
  requestId: ExportRequestId;
  jobId: ExportJobId;
  artifacts: ExportArtifactRef[];
  completedAt?: string;
  metadata?: unknown;
}

export interface ExportSubmissionImmediateSuccess {
  kind: "immediate_success";
  result: ExportTerminalResult;
}

export interface ExportSubmissionAcceptedJob {
  kind: "accepted_job";
  handle: ExportJobHandle;
}

export interface ExportSubmissionFailure {
  kind: "failure";
  failure: ExportFailure;
}

export type ExportSubmissionResult =
  | ExportSubmissionImmediateSuccess
  | ExportSubmissionAcceptedJob
  | ExportSubmissionFailure;

export interface ExportPollPending {
  kind: "pending";
  handle: ExportJobHandle;
  progress?: ExportProgressSnapshot;
}

export interface ExportPollTerminalSuccess {
  kind: "terminal_success";
  result: ExportTerminalResult;
}

export interface ExportPollTerminalFailure {
  kind: "terminal_failure";
  failure: ExportFailure;
  jobId?: ExportJobId;
}

export type ExportPollResult =
  | ExportPollPending
  | ExportPollTerminalSuccess
  | ExportPollTerminalFailure;

// Request references timeline editorial state only.
// Scene clip content remains referenced indirectly through the timeline by sceneId.
export interface TimelineExportRequest {
  requestId: ExportRequestId;
  timelineId: TimelineId;
  renderSettings: ExportRenderSettings;
  requestedAt: string;
  metadata?: unknown;
}
