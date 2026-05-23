import type { CreditPolicyDraftEstimate } from "./credits";

export type BillingProviderKind = "stripe" | "paddle";

export interface BillingProviderBoundarySummary {
  state: "not_enabled_yet";
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
  state: "not_enabled_yet";
  acceptedProviders: BillingProviderKind[];
  message: string;
}

export interface BillingPlansResult {
  kind: "plans";
  message: string;
  providerBoundary: BillingProviderBoundarySummary;
  checkoutBoundary: BillingCheckoutBoundarySummary;
  webhookBoundary: BillingWebhookBoundarySummary;
  plans: BillingPlanSummary[];
  draftEstimates: CreditPolicyDraftEstimate[];
}
