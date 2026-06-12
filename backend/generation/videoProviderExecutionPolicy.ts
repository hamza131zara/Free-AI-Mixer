import type {
  BackendVideoGenerationProviderId,
  BackendVideoProviderFailureStatus,
} from "./videoGenerationProviderAdapter";

export type BackendVideoExecutionBillingMode = "byok" | "platform_paid";

export interface BackendVideoPlatformCreditReadiness {
  kind: "ready" | "not_configured";
  message?: string;
}

export type BackendVideoProviderExecutionPolicyDecision =
  | {
      kind: "video_provider_execution_allowed";
      status: "video_provider_execution_allowed";
      providerId: BackendVideoGenerationProviderId;
    }
  | {
      kind: "video_provider_execution_blocked";
      status: BackendVideoProviderFailureStatus;
      providerId: BackendVideoGenerationProviderId;
      message: string;
    };

export interface EvaluateBackendVideoProviderExecutionPolicyInput {
  billingMode: BackendVideoExecutionBillingMode;
  platformCreditReadiness?: BackendVideoPlatformCreditReadiness;
  providerAdapterConfigured: boolean;
  providerId: BackendVideoGenerationProviderId;
}

export const evaluateBackendVideoProviderExecutionPolicy = ({
  billingMode,
  platformCreditReadiness,
  providerAdapterConfigured,
  providerId,
}: EvaluateBackendVideoProviderExecutionPolicyInput): BackendVideoProviderExecutionPolicyDecision => {
  if (billingMode === "platform_paid") {
    if (platformCreditReadiness?.kind !== "ready") {
      return {
        kind: "video_provider_execution_blocked",
        message:
          platformCreditReadiness?.message ??
          "Platform credits are not configured for video generation.",
        providerId,
        status: "platform_credits_not_configured",
      };
    }

    return {
      kind: "video_provider_execution_blocked",
      message:
        "Platform-paid video provider execution is not configured for this boundary.",
      providerId,
      status: "video_provider_execution_blocked",
    };
  }

  if (!providerAdapterConfigured) {
    return {
      kind: "video_provider_execution_blocked",
      message:
        "BYOK video generation is unavailable until a real video adapter is audited and configured.",
      providerId,
      status: "video_provider_not_configured",
    };
  }

  return {
    kind: "video_provider_execution_blocked",
    message:
      "Real video provider execution remains blocked until provider billing, quota, polling, verification, and storage are audited.",
    providerId,
    status: "video_provider_execution_blocked",
  };
};
