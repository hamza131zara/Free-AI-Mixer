import type {
  BackendVideoGenerationLifecycleState,
  BackendVideoProviderIdForLifecycle,
} from "./videoGenerationJobLifecycle";

export type BackendVideoGenerationProviderId = Exclude<
  BackendVideoProviderIdForLifecycle,
  "mock_local"
>;

export type BackendVideoProviderFailureStatus =
  | "video_provider_not_configured"
  | "video_provider_unavailable"
  | "video_provider_billing_or_quota_required"
  | "video_provider_execution_blocked"
  | "video_provider_polling_unavailable"
  | "video_provider_cancel_unavailable"
  | "video_artifact_verification_unavailable"
  | "video_artifact_storage_unavailable"
  | "platform_credits_not_configured";

export type BackendVideoProviderReadiness =
  | {
      kind: "video_provider_ready";
      providerId: BackendVideoGenerationProviderId;
    }
  | {
      kind: "video_provider_unavailable";
      providerId: BackendVideoGenerationProviderId;
      status: BackendVideoProviderFailureStatus;
      message: string;
    };

export interface BackendVideoGenerationSubmitInput {
  jobId: string;
  prompt: string;
  providerId: BackendVideoGenerationProviderId;
  requestId: string;
  userId: string;
  workspaceId: string;
  signal?: AbortSignal;
}

export interface BackendVideoGenerationPollInput {
  providerId: BackendVideoGenerationProviderId;
  providerJobRef: string;
  userId: string;
  workspaceId: string;
  signal?: AbortSignal;
}

export interface BackendVideoGenerationCancelInput {
  providerId: BackendVideoGenerationProviderId;
  providerJobRef: string;
  userId: string;
  workspaceId: string;
  signal?: AbortSignal;
}

export type BackendVideoProviderExecutionResult =
  | {
      kind: "video_provider_job_submitted";
      lifecycleState: Extract<
        BackendVideoGenerationLifecycleState,
        "submitted" | "queued"
      >;
      message: string;
    }
  | {
      kind: "video_provider_job_polled";
      lifecycleState: BackendVideoGenerationLifecycleState;
      message: string;
    }
  | {
      kind: "video_provider_job_cancelled";
      lifecycleState: "cancelled";
      message: string;
    }
  | {
      kind: "video_provider_blocked";
      status: BackendVideoProviderFailureStatus;
      lifecycleState: "failed";
      message: string;
    };

export interface BackendVideoGenerationProviderAdapter {
  readonly providerId: BackendVideoGenerationProviderId;
  getReadiness(): BackendVideoProviderReadiness;
  submitVideoGenerationJob(
    input: BackendVideoGenerationSubmitInput,
  ): Promise<BackendVideoProviderExecutionResult>;
  pollVideoGenerationJob(
    input: BackendVideoGenerationPollInput,
  ): Promise<BackendVideoProviderExecutionResult>;
  cancelVideoGenerationJob(
    input: BackendVideoGenerationCancelInput,
  ): Promise<BackendVideoProviderExecutionResult>;
}

export const supportedFutureVideoProviderIds: readonly BackendVideoGenerationProviderId[] =
  ["veo", "runway", "pika", "gemini_video"] as const;

const blocked = (
  status: BackendVideoProviderFailureStatus,
  message: string,
): BackendVideoProviderExecutionResult => ({
  kind: "video_provider_blocked",
  lifecycleState: "failed",
  message,
  status,
});

export const createNotConfiguredVideoGenerationProviderAdapter = (
  providerId: BackendVideoGenerationProviderId,
): BackendVideoGenerationProviderAdapter => ({
  providerId,
  getReadiness: () => ({
    kind: "video_provider_unavailable",
    message:
      "Real video provider execution is not configured for this backend boundary.",
    providerId,
    status: "video_provider_not_configured",
  }),
  submitVideoGenerationJob: async () =>
    blocked(
      "video_provider_execution_blocked",
      "Real video provider submit execution is blocked until provider access, billing, and artifact verification are audited.",
    ),
  pollVideoGenerationJob: async () =>
    blocked(
      "video_provider_polling_unavailable",
      "Real video provider polling is unavailable until an audited async provider boundary exists.",
    ),
  cancelVideoGenerationJob: async () =>
    blocked(
      "video_provider_cancel_unavailable",
      "Real video provider cancellation is unavailable until an audited async provider boundary exists.",
    ),
});

export const createNotConfiguredVideoGenerationProviderAdapters = (): BackendVideoGenerationProviderAdapter[] =>
  supportedFutureVideoProviderIds.map((providerId) =>
    createNotConfiguredVideoGenerationProviderAdapter(providerId),
  );
