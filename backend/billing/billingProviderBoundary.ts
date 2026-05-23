import type { BackendBillingProviderKind } from "../contracts/billingHttpTypes";

export type BillingProviderBoundaryState = "not_enabled_yet";
export type BillingWebhookBoundaryState = "not_live";

export interface BillingProviderBoundary {
  state: BillingProviderBoundaryState;
  supportedProviders: BackendBillingProviderKind[];
  message: string;
}

export interface BillingCheckoutBoundary {
  state: BillingProviderBoundaryState;
  acceptedProviders: BackendBillingProviderKind[];
  message: string;
}

export interface BillingWebhookBoundary {
  state: BillingWebhookBoundaryState;
  acceptedProviders: BackendBillingProviderKind[];
  message: string;
}

export interface BillingWebhookEventBoundary {
  provider: BackendBillingProviderKind;
  state: BillingWebhookBoundaryState;
  message: string;
}

export const defaultBillingProviderBoundary: BillingProviderBoundary = {
  state: "not_enabled_yet",
  supportedProviders: ["stripe", "paddle"],
  message: "Billing provider wiring is not enabled in this product phase.",
};

export const defaultBillingCheckoutBoundary: BillingCheckoutBoundary = {
  state: "not_enabled_yet",
  acceptedProviders: ["stripe", "paddle"],
  message: "Checkout is not enabled yet. No payment processor requests are made in this phase.",
};

export const defaultBillingWebhookBoundary: BillingWebhookBoundary = {
  state: "not_live",
  acceptedProviders: ["stripe", "paddle"],
  message: "Webhook processing is not live. Credits cannot be granted from purchase events in this phase.",
};
