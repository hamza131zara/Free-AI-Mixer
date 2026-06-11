import { create } from "zustand";
import { getBillingPlans } from "../services/billingService";
import type { BillingPlansResult } from "../types/billing";

export interface BillingStoreState {
  status: "unknown" | "ready" | "unavailable";
  message: string;
  plans: BillingPlansResult["plans"];
  draftEstimates: BillingPlansResult["draftEstimates"];
  providerBoundary?: BillingPlansResult["providerBoundary"];
  checkoutBoundary?: BillingPlansResult["checkoutBoundary"];
  webhookBoundary?: BillingPlansResult["webhookBoundary"];
  subscriptionBoundary?: BillingPlansResult["subscriptionBoundary"];
  platformCreditsBoundary?: BillingPlansResult["platformCreditsBoundary"];
  providerCostEstimates: BillingPlansResult["providerCostEstimates"];
  pendingAction: "refresh" | null;
  refreshBilling: () => Promise<void>;
}

export const useBillingStore = create<BillingStoreState>((set) => ({
  status: "unknown",
  message: "Loading draft pricing policy.",
  plans: [],
  draftEstimates: [],
  providerBoundary: undefined,
  checkoutBoundary: undefined,
  webhookBoundary: undefined,
  subscriptionBoundary: undefined,
  platformCreditsBoundary: undefined,
  providerCostEstimates: [],
  pendingAction: null,
  refreshBilling: async () => {
    set({ pendingAction: "refresh" });
    const result = await getBillingPlans();

    set({
      status: "ready",
      message: result.message,
      plans: result.plans,
      draftEstimates: result.draftEstimates,
      providerBoundary: result.providerBoundary,
      checkoutBoundary: result.checkoutBoundary,
      webhookBoundary: result.webhookBoundary,
      subscriptionBoundary: result.subscriptionBoundary,
      platformCreditsBoundary: result.platformCreditsBoundary,
      providerCostEstimates: result.providerCostEstimates,
      pendingAction: null,
    });
  },
}));
