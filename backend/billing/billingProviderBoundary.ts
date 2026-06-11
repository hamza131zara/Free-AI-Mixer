import type { BackendBillingProviderKind } from "../contracts/billingHttpTypes";

export type BillingProviderBoundaryState =
  | "not_enabled_yet"
  | "billing_provider_not_configured";
export type BillingCheckoutBoundaryState =
  | "not_enabled_yet"
  | "checkout_unavailable";
export type BillingWebhookBoundaryState = "not_live";
export type BillingSubscriptionBoundaryState = "subscriptions_not_configured";
export type PlatformCreditsBoundaryState = "platform_credits_not_configured";

export interface BillingProviderBoundary {
  state: BillingProviderBoundaryState;
  supportedProviders: BackendBillingProviderKind[];
  message: string;
}

export interface BillingCheckoutBoundary {
  state: BillingCheckoutBoundaryState;
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

export interface BillingSubscriptionBoundary {
  state: BillingSubscriptionBoundaryState;
  message: string;
}

export interface PlatformCreditsBoundary {
  state: PlatformCreditsBoundaryState;
  message: string;
}

export const defaultBillingProviderBoundary: BillingProviderBoundary = {
  state: "billing_provider_not_configured",
  supportedProviders: ["stripe", "paddle"],
  message: "Billing provider wiring is not enabled in this product phase.",
};

export const defaultBillingCheckoutBoundary: BillingCheckoutBoundary = {
  state: "checkout_unavailable",
  acceptedProviders: ["stripe", "paddle"],
  message: "Checkout is not enabled yet. No payment processor requests are made in this phase.",
};

export const defaultBillingWebhookBoundary: BillingWebhookBoundary = {
  state: "not_live",
  acceptedProviders: ["stripe", "paddle"],
  message: "Webhook processing is not live. Credits cannot be granted from purchase events in this phase.",
};

export const defaultBillingSubscriptionBoundary: BillingSubscriptionBoundary = {
  state: "subscriptions_not_configured",
  message:
    "Subscriptions are not configured. No paid entitlement, plan activation, or renewal state is live.",
};

export const defaultPlatformCreditsBoundary: PlatformCreditsBoundary = {
  state: "platform_credits_not_configured",
  message:
    "Platform credits are not configured for paid generation yet. Future real provider calls must reserve credits first.",
};
