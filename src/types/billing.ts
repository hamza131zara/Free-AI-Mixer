import type { CreditPolicyDraftEstimate } from "./credits";

export type BillingProviderKind = "stripe" | "paddle";

export interface BillingProviderBoundarySummary {
  state: "not_enabled_yet" | "billing_provider_not_configured";
  supportedProviders: BillingProviderKind[];
  message: string;
}

export interface BillingPlanSummary {
  planId: "free_byok_policy" | "paid_plan_draft";
  title: string;
  status: "draft_only";
  summary: string;
}

export interface BillingWebhookBoundarySummary {
  state: "not_live";
  acceptedProviders: BillingProviderKind[];
  message: string;
}

export interface BillingCheckoutBoundarySummary {
  state: "not_enabled_yet" | "checkout_unavailable";
  acceptedProviders: BillingProviderKind[];
  message: string;
}

export interface BillingSubscriptionBoundarySummary {
  state: "subscriptions_not_configured";
  message: string;
}

export interface PlatformCreditsBoundarySummary {
  state: "platform_credits_not_configured";
  message: string;
}

export interface ProviderCostEstimateSummary {
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

export interface BillingPlansResult {
  kind: "plans";
  message: string;
  providerBoundary: BillingProviderBoundarySummary;
  checkoutBoundary: BillingCheckoutBoundarySummary;
  webhookBoundary: BillingWebhookBoundarySummary;
  subscriptionBoundary: BillingSubscriptionBoundarySummary;
  platformCreditsBoundary: PlatformCreditsBoundarySummary;
  plans: BillingPlanSummary[];
  draftEstimates: CreditPolicyDraftEstimate[];
  providerCostEstimates: ProviderCostEstimateSummary[];
}
