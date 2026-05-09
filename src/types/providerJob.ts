import type { GeneratedScene, SceneGenerationError, SceneProvider } from "./scene";

// Phase 3.8B contract types only.
// These types define the domain model for long-running provider jobs, but they are
// not wired into runtime orchestration yet. The app still uses the existing
// request/response flow until Phase 3.8C introduces polling-aware behavior.

export type ProviderJobId = string;

export type ProviderJobStatus =
  | "submitted"
  | "pending"
  | "polling"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled";

export type ProviderJobActiveStatus = Extract<
  ProviderJobStatus,
  "submitted" | "pending" | "polling" | "processing"
>;

export interface ProviderJobMetadata {
  provider: SceneProvider;
  createdAt?: string;
  acceptedAt?: string;
  completedAt?: string;
  statusMessage?: string;
  pollAfterMs?: number;
  attemptCount?: number;
  remoteStatus?: string;
  details?: unknown;
}

export const providerJobResumeVersion = 1;

export interface ProviderJobHandle {
  provider: SceneProvider;
  jobId: ProviderJobId;
  status: ProviderJobActiveStatus;
  metadata?: ProviderJobMetadata;
}

export interface ProviderJobSubmission {
  kind: "submitted";
  handle: ProviderJobHandle;
}

export interface ProviderJobTerminalResult {
  kind: "success";
  provider: SceneProvider;
  scene: GeneratedScene;
  metadata?: ProviderJobMetadata;
}

export interface ProviderJobFailure {
  kind: "failure";
  provider: SceneProvider;
  error: SceneGenerationError;
  jobId?: ProviderJobId;
  metadata?: ProviderJobMetadata;
}

export interface ProviderJobPollResultPending {
  kind: "pending";
  handle: ProviderJobHandle;
}

export interface ProviderJobPollResultSuccess {
  kind: "success";
  result: ProviderJobTerminalResult;
}

export interface ProviderJobPollResultFailure {
  kind: "failure";
  failure: ProviderJobFailure;
}

export type ProviderJobPollResult =
  | ProviderJobPollResultPending
  | ProviderJobPollResultSuccess
  | ProviderJobPollResultFailure;

// Future-safe outcome union for provider generation.
// Phase 3.8B defines the contract only; current runtime services still return
// immediate success or throw transport/provider errors instead of returning this union.
export type ProviderGenerationOutcome =
  | ProviderJobTerminalResult
  | ProviderJobSubmission
  | ProviderJobFailure;
