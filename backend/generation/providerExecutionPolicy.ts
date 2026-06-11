import type { BackendSupportedProviderId } from "../contracts/providerSettingsHttpTypes";
export type ProviderExecutionBillingMode = "byok" | "platform_paid";

export type ProviderExecutionPolicyKind =
  | "byok_real_provider"
  | "platform_paid_provider"
  | "mock_local"
  | "unsupported_provider"
  | "provider_policy_blocked";

export type ProviderExecutionPolicyStatus =
  | "provider_execution_allowed"
  | "platform_credits_not_configured"
  | "platform_paid_provider_not_configured"
  | "provider_execution_policy_blocked"
  | "provider_capability_unavailable"
  | "provider_billing_or_quota_required";

export type ProviderExecutionPolicyDiagnosticCode =
  | "platform_credits_not_configured"
  | "platform_paid_provider_not_configured"
  | "provider_execution_policy_blocked"
  | "provider_capability_unavailable"
  | "provider_billing_or_quota_required";

export interface ProviderExecutionPolicyInput {
  billingMode?: ProviderExecutionBillingMode;
  generationKind: "image" | "video";
  providerId: BackendSupportedProviderId | "mock_local";
  platformPaidReadiness?:
    | {
        kind: "ready";
        status: "credit_readiness_available" | "credits_reserved";
      }
    | {
        kind: "blocked";
        status: "platform_credits_not_configured" | "credit_mutation_failed";
        message: string;
      };
}

export type ProviderExecutionPolicyDecision =
  | {
      kind: "byok_real_provider";
      status: "provider_execution_allowed";
      billingMode: "byok";
      providerId: "openai";
    }
  | {
      kind: "mock_local";
      status: "provider_execution_allowed";
      billingMode: "byok";
      providerId: "mock_local";
    }
  | {
      kind: "platform_paid_provider";
      status: "provider_execution_allowed";
      billingMode: "platform_paid";
      providerId: "openai";
    }
  | {
      kind: "unsupported_provider" | "provider_policy_blocked";
      status: Exclude<ProviderExecutionPolicyStatus, "provider_execution_allowed">;
      billingMode: ProviderExecutionBillingMode;
      providerId: BackendSupportedProviderId | "mock_local";
      diagnosticCode: ProviderExecutionPolicyDiagnosticCode;
      message: string;
    };

const block = (
  input: ProviderExecutionPolicyInput,
  status: Exclude<ProviderExecutionPolicyStatus, "provider_execution_allowed">,
  message: string,
  kind: "unsupported_provider" | "provider_policy_blocked" = "provider_policy_blocked",
): ProviderExecutionPolicyDecision => ({
  billingMode: input.billingMode ?? "byok",
  diagnosticCode: status,
  kind,
  message,
  providerId: input.providerId,
  status,
});

export const evaluateProviderExecutionPolicy = (
  input: ProviderExecutionPolicyInput,
): ProviderExecutionPolicyDecision => {
  const billingMode = input.billingMode ?? "byok";

  if (input.providerId === "mock_local") {
    return {
      billingMode: "byok",
      kind: "mock_local",
      providerId: "mock_local",
      status: "provider_execution_allowed",
    };
  }

  if (input.providerId !== "openai") {
    return block(
      input,
      "provider_capability_unavailable",
      "This provider is not executable in the current real-generation boundary.",
      "unsupported_provider",
    );
  }

  if (input.generationKind !== "image") {
    return block(
      input,
      "provider_capability_unavailable",
      "Only OpenAI image generation is executable in this block.",
      "unsupported_provider",
    );
  }

  if (billingMode === "platform_paid") {
    if (!input.platformPaidReadiness) {
      return block(
        input,
        "platform_credits_not_configured",
        "Platform credits are not configured for platform-paid provider generation.",
      );
    }

    if (input.platformPaidReadiness.kind !== "ready") {
      return block(
        input,
        input.platformPaidReadiness.status === "platform_credits_not_configured"
          ? "platform_credits_not_configured"
          : "provider_execution_policy_blocked",
        input.platformPaidReadiness.message,
      );
    }

    return {
      billingMode,
      kind: "platform_paid_provider",
      providerId: "openai",
      status: "provider_execution_allowed",
    };
  }

  return {
    billingMode: "byok",
    kind: "byok_real_provider",
    providerId: "openai",
    status: "provider_execution_allowed",
  };
};
