import type { SupportedProviderId } from "./providerSettings";

export type ProviderCapabilityPolicyStatus =
  | "not_connected"
  | "connected_unvalidated"
  | "validated"
  | "image_generation_available"
  | "video_generation_available"
  | "provider_billing_required"
  | "provider_quota_unavailable"
  | "model_unavailable"
  | "platform_credits_not_configured";

export interface ProviderCapabilityPolicy {
  providerId: SupportedProviderId;
  displayName: string;
  supportsText: boolean;
  supportsImage: boolean;
  supportsVideo: boolean;
  byokSupported: boolean;
  platformPaidSupported: boolean;
  freeApiQuotaKnown: boolean;
  billingMayBeRequired: boolean;
  statuses: ProviderCapabilityPolicyStatus[];
  freePlanCopy: string;
  byokCopy: string;
  paidPlanCopy: string;
  unavailableCopy: string;
}

export interface PlatformGenerationPolicyCopy {
  freeWorkspaceCopy: string;
  byokQuotaCopy: string;
  providerBillingCopy: string;
  paidPlatformCopy: string;
  mockGenerationCopy: string;
}

export interface LaunchBlockRoadmapItem {
  blockId: string;
  title: string;
  summary: string;
}
