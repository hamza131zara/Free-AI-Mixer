import type { BackendCreditPolicyDraftEstimate } from "./creditsHttpTypes";

export type BackendBillingProviderKind = "stripe" | "paddle";

export interface BackendBillingProviderBoundarySummary {
  state: "not_enabled_yet" | "billing_provider_not_configured";
  supportedProviders: BackendBillingProviderKind[];
  message: string;
}

export interface BackendBillingCheckoutBoundarySummary {
  state: "not_enabled_yet" | "checkout_unavailable";
  acceptedProviders: BackendBillingProviderKind[];
  message: string;
}

export interface BackendBillingWebhookBoundarySummary {
  state: "not_live";
  acceptedProviders: BackendBillingProviderKind[];
  message: string;
}

export interface BackendBillingSubscriptionBoundarySummary {
  state: "subscriptions_not_configured";
  message: string;
}

export interface BackendPlatformCreditsBoundarySummary {
  state: "platform_credits_not_configured";
  message: string;
}

export interface BackendBillingPlanSummary {
  planId: "free_byok_policy" | "paid_plan_draft";
  title: string;
  status: "draft_only";
  summary: string;
}

export interface BackendProviderCostEstimateSummary {
  providerId: "openai" | "gemini" | "imagen" | "veo" | "runway" | "pika" | "mock_local";
  surface:
    | "image_generation"
    | "video_generation"
    | "artifact_storage"
    | "artifact_delivery";
  unit: "provider_billed_request" | "provider_billed_second" | "storage_byte_month";
  estimateState:
    | "draft_only"
    | "provider_billing_required"
    | "platform_credits_not_configured";
  message: string;
}

export interface BackendBillingPlansResponse {
  kind: "billing_plans";
  message: string;
  providerBoundary: BackendBillingProviderBoundarySummary;
  checkoutBoundary: BackendBillingCheckoutBoundarySummary;
  webhookBoundary: BackendBillingWebhookBoundarySummary;
  subscriptionBoundary: BackendBillingSubscriptionBoundarySummary;
  platformCreditsBoundary: BackendPlatformCreditsBoundarySummary;
  plans: BackendBillingPlanSummary[];
  draftEstimates: BackendCreditPolicyDraftEstimate[];
  providerCostEstimates: BackendProviderCostEstimateSummary[];
}
