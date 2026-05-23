import { create } from "zustand";
import { getCreditPolicy, getCreditsStatus } from "../services/creditsService";
import type { CreditPolicySummary, WalletSummary } from "../types/credits";

export interface CreditsStoreState {
  policyMessage: string;
  policy?: CreditPolicySummary;
  accessStatus: "unknown" | "authenticated" | "unauthenticated" | "unavailable";
  accessMessage: string;
  accessReasonCode?: string;
  wallet?: WalletSummary;
  pendingAction: "refresh" | null;
  refreshCredits: () => Promise<void>;
}

const unknownAccessMessage = "Checking credits status.";

export const useCreditsStore = create<CreditsStoreState>((set) => ({
  policyMessage: "Loading credit policy.",
  policy: undefined,
  accessStatus: "unknown",
  accessMessage: unknownAccessMessage,
  accessReasonCode: undefined,
  wallet: undefined,
  pendingAction: null,
  refreshCredits: async () => {
    set({ pendingAction: "refresh" });

    const [policyResult, statusResult] = await Promise.all([
      getCreditPolicy(),
      getCreditsStatus(),
    ]);

    if (statusResult.kind === "authenticated") {
      set({
        policyMessage: policyResult.message,
        policy: policyResult.policy,
        accessStatus: "authenticated",
        accessMessage: statusResult.message,
        accessReasonCode: undefined,
        wallet: statusResult.wallet,
        pendingAction: null,
      });
      return;
    }

    if (statusResult.kind === "unauthenticated") {
      set({
        policyMessage: policyResult.message,
        policy: policyResult.policy,
        accessStatus: "unauthenticated",
        accessMessage: statusResult.message,
        accessReasonCode: statusResult.reason,
        wallet: undefined,
        pendingAction: null,
      });
      return;
    }

    set({
      policyMessage: policyResult.message,
      policy: policyResult.policy,
      accessStatus: "unavailable",
      accessMessage: statusResult.message,
      accessReasonCode: statusResult.code,
      wallet: undefined,
      pendingAction: null,
    });
  },
}));
