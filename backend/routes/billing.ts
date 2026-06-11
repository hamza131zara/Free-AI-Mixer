import { Router } from "express";
import type { Response } from "express";
import type { BackendBillingPlansResponse } from "../contracts/billingHttpTypes";
import { draftCreditCostEstimates } from "../credits/creditPolicy";
import {
  defaultBillingCheckoutBoundary,
  defaultBillingProviderBoundary,
  defaultBillingSubscriptionBoundary,
  defaultBillingWebhookBoundary,
  defaultPlatformCreditsBoundary,
} from "../billing/billingProviderBoundary";
import { createProviderCostTrackingBoundary } from "../billing/providerCostTracking";

export const createBillingRouter = (): Router => {
  const router = Router();
  const providerCostTracking = createProviderCostTrackingBoundary();

  router.get(
    "/billing/plans",
    (_request, response: Response<BackendBillingPlansResponse>) => {
      response.status(200).json({
        kind: "billing_plans",
        message:
          "Pricing is presented as draft planning only. No checkout, payment processor, webhook, or entitlement flow is enabled.",
        providerBoundary: defaultBillingProviderBoundary,
        checkoutBoundary: defaultBillingCheckoutBoundary,
        webhookBoundary: defaultBillingWebhookBoundary,
        subscriptionBoundary: defaultBillingSubscriptionBoundary,
        platformCreditsBoundary: defaultPlatformCreditsBoundary,
        plans: [
          {
            planId: "free_byok_policy",
            title: "Free BYOK policy draft",
            status: "draft_only",
            summary:
              "Free BYOK users may later get 2500 daily Free AI Mixer platform credits while still paying provider generation cost through their own API keys.",
          },
          {
            planId: "paid_plan_draft",
            title: "Paid plan draft",
            status: "draft_only",
            summary:
              "Paid plans, purchased credits, longer retention, and subscriptions remain planning-only and are not final business commitments.",
          },
        ],
        draftEstimates: draftCreditCostEstimates,
        providerCostEstimates: providerCostTracking.listEstimates(),
      });
    },
  );

  return router;
};
