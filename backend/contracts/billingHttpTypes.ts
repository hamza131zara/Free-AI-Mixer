import type { BackendCreditPolicyDraftEstimate } from "./creditsHttpTypes";

export type BackendBillingProviderKind = "stripe" | "paddle";

export interface BackendBillingProviderBoundarySummary {
  state: "not_enabled_yet";
  supportedProviders: BackendBillingProviderKind[];
  message: string;
}

export interface BackendBillingCheckoutBoundarySummary {
  state: "not_enabled_yet";
  acceptedProviders: BackendBillingProviderKind[];
  message: string;
}

export interface BackendBillingWebhookBoundarySummary {
  state: "not_live";
  acceptedProviders: BackendBillingProviderKind[];
  message: string;
}

export interface BackendBillingPlanSummary {
  planId: "free_byok_policy" | "paid_plan_draft";
  title: string;
  status: "draft_only";
  summary: string;
}

export interface BackendBillingPlansResponse {
  kind: "billing_plans";
  message: string;
  providerBoundary: BackendBillingProviderBoundarySummary;
  checkoutBoundary: BackendBillingCheckoutBoundarySummary;
  webhookBoundary: BackendBillingWebhookBoundarySummary;
  plans: BackendBillingPlanSummary[];
  draftEstimates: BackendCreditPolicyDraftEstimate[];
}
