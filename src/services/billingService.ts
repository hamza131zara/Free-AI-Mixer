import type { BillingPlansResult } from "../types/billing";

interface BackendBillingPlansResponse {
  kind: "billing_plans";
  message?: string;
  providerBoundary: BillingPlansResult["providerBoundary"];
  checkoutBoundary: BillingPlansResult["checkoutBoundary"];
  webhookBoundary: BillingPlansResult["webhookBoundary"];
  plans: BillingPlansResult["plans"];
  draftEstimates: BillingPlansResult["draftEstimates"];
}

const billingPlansEndpoint = "/billing/plans";

const parseJson = async <Payload>(response: Response): Promise<Payload | undefined> => {
  const responseText = await response.text();

  if (!responseText) {
    return undefined;
  }

  try {
    return JSON.parse(responseText) as Payload;
  } catch {
    return undefined;
  }
};

export const getBillingPlans = async (): Promise<BillingPlansResult> => {
  try {
    const response = await fetch(billingPlansEndpoint, {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendBillingPlansResponse>(response);

    if (!response.ok || !payload || payload.kind !== "billing_plans") {
      return {
        kind: "plans",
        message: "Pricing plans are currently unavailable because the backend boundary could not be reached.",
        providerBoundary: {
          state: "not_enabled_yet",
          supportedProviders: ["stripe", "paddle"],
          message: "Billing providers are not configured in this product phase.",
        },
        checkoutBoundary: {
          state: "not_enabled_yet",
          acceptedProviders: ["stripe", "paddle"],
          message: "Checkout is not enabled yet.",
        },
        webhookBoundary: {
          state: "not_live",
          acceptedProviders: ["stripe", "paddle"],
          message: "Webhook processing is not live.",
        },
        plans: [],
        draftEstimates: [],
      };
    }

    return {
      kind: "plans",
      message:
        payload.message ??
        "Pricing is presented as draft policy only. No checkout or subscription state is enabled.",
      providerBoundary: payload.providerBoundary,
      checkoutBoundary: payload.checkoutBoundary,
      webhookBoundary: payload.webhookBoundary,
      plans: payload.plans,
      draftEstimates: payload.draftEstimates,
    };
  } catch {
    return {
      kind: "plans",
      message: "Pricing plans are currently unavailable because the backend boundary could not be reached.",
      providerBoundary: {
        state: "not_enabled_yet",
        supportedProviders: ["stripe", "paddle"],
        message: "Billing providers are not configured in this product phase.",
      },
      checkoutBoundary: {
        state: "not_enabled_yet",
        acceptedProviders: ["stripe", "paddle"],
        message: "Checkout is not enabled yet.",
      },
      webhookBoundary: {
        state: "not_live",
        acceptedProviders: ["stripe", "paddle"],
        message: "Webhook processing is not live.",
      },
      plans: [],
      draftEstimates: [],
    };
  }
};
