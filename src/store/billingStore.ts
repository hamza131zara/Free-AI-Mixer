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
      pendingAction: null,
    });
  },
}));
