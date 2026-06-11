import type { ProviderCostEstimate } from "./providerCostPolicy";
import { providerCostPolicy } from "./providerCostPolicy";

export type ProviderCostTrackingReadiness =
  | {
      kind: "ready";
      status: "draft_estimates_available";
    }
  | {
      kind: "unavailable";
      status: "provider_cost_tracking_not_configured";
      message: string;
    };

export interface ProviderCostTrackingBoundary {
  getReadiness(): ProviderCostTrackingReadiness;
  listEstimates(): ProviderCostEstimate[];
}

export const createProviderCostTrackingBoundary =
  (): ProviderCostTrackingBoundary => ({
    getReadiness: () => ({
      kind: "ready",
      status: "draft_estimates_available",
    }),
    listEstimates: () => providerCostPolicy,
  });
