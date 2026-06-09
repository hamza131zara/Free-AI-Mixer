import type {
  LaunchBlockRoadmapItem,
  PlatformGenerationPolicyCopy,
  ProviderCapabilityPolicy,
} from "../types/providerCapabilityPolicy";
import type { SupportedProviderId } from "../types/providerSettings";

export const platformGenerationPolicyCopy: PlatformGenerationPolicyCopy = {
  freeWorkspaceCopy: "Free workspace and mock/demo generation are available.",
  byokQuotaCopy:
    "Bring your own API key to use provider quota where available. BYOK does not create provider credits.",
  providerBillingCopy:
    "Some image/video provider APIs require separate provider billing or an eligible provider account.",
  paidPlatformCopy:
    "Platform credits/subscriptions are coming later for users who do not want to manage API keys.",
  mockGenerationCopy:
    "Mock/demo/local generation stays available as a safe metadata-only workspace path without external provider calls.",
};

export const providerCapabilityPolicies: ProviderCapabilityPolicy[] = [
  {
    providerId: "openai",
    displayName: "OpenAI",
    supportsText: true,
    supportsImage: true,
    supportsVideo: false,
    byokSupported: true,
    platformPaidSupported: true,
    freeApiQuotaKnown: false,
    billingMayBeRequired: true,
    statuses: [
      "not_connected",
      "connected_unvalidated",
      "validated",
      "provider_billing_required",
      "provider_quota_unavailable",
      "platform_credits_not_configured",
    ],
    freePlanCopy:
      "Free plan users can use the workspace and mock/demo generation without OpenAI calls.",
    byokCopy:
      "OpenAI BYOK uses quota or billing from the user's OpenAI account where available.",
    paidPlanCopy:
      "Future paid Free AI Mixer plans may use platform-owned OpenAI access after credits and subscriptions exist.",
    unavailableCopy:
      "OpenAI image generation is unavailable when the key, account quota, billing, or selected model is not eligible.",
  },
  {
    providerId: "google",
    displayName: "Google Gemini / Imagen / Veo",
    supportsText: true,
    supportsImage: true,
    supportsVideo: true,
    byokSupported: true,
    platformPaidSupported: true,
    freeApiQuotaKnown: false,
    billingMayBeRequired: true,
    statuses: [
      "not_connected",
      "connected_unvalidated",
      "validated",
      "provider_billing_required",
      "provider_quota_unavailable",
      "model_unavailable",
      "platform_credits_not_configured",
    ],
    freePlanCopy:
      "Free plan users can use mock/demo generation while Google provider access stays account-dependent.",
    byokCopy:
      "Google BYOK uses Gemini, Imagen, or Veo quota only when the user's Google account and project permit it.",
    paidPlanCopy:
      "Future paid Free AI Mixer plans may route through platform-owned Google provider access after billing is implemented.",
    unavailableCopy:
      "Google image or video generation is unavailable when quota, billing, model access, or provider setup is missing.",
  },
  {
    providerId: "runway",
    displayName: "Runway",
    supportsText: false,
    supportsImage: false,
    supportsVideo: true,
    byokSupported: true,
    platformPaidSupported: true,
    freeApiQuotaKnown: false,
    billingMayBeRequired: true,
    statuses: [
      "not_connected",
      "connected_unvalidated",
      "validated",
      "video_generation_available",
      "provider_billing_required",
      "provider_quota_unavailable",
      "platform_credits_not_configured",
    ],
    freePlanCopy:
      "Free plan users can inspect the mock video boundary without Runway calls.",
    byokCopy:
      "Runway BYOK depends on the user's own Runway account, access, and billing.",
    paidPlanCopy:
      "Future paid Free AI Mixer plans may use platform-owned video provider access after credits/subscriptions exist.",
    unavailableCopy:
      "Runway video generation remains unavailable until a provider account and future video execution path are approved.",
  },
  {
    providerId: "luma",
    displayName: "Luma",
    supportsText: false,
    supportsImage: false,
    supportsVideo: true,
    byokSupported: true,
    platformPaidSupported: true,
    freeApiQuotaKnown: false,
    billingMayBeRequired: true,
    statuses: [
      "not_connected",
      "connected_unvalidated",
      "validated",
      "video_generation_available",
      "provider_billing_required",
      "provider_quota_unavailable",
      "platform_credits_not_configured",
    ],
    freePlanCopy:
      "Free plan users can use the video boundary demo while Luma provider calls remain disabled.",
    byokCopy:
      "Luma BYOK depends on the user's own Luma account, quota, and billing eligibility.",
    paidPlanCopy:
      "Future paid Free AI Mixer plans may use platform-owned Luma access after billing controls exist.",
    unavailableCopy:
      "Luma video generation remains unavailable until a provider account and future video execution path are approved.",
  },
  {
    providerId: "stability",
    displayName: "Stability AI",
    supportsText: false,
    supportsImage: true,
    supportsVideo: false,
    byokSupported: true,
    platformPaidSupported: true,
    freeApiQuotaKnown: false,
    billingMayBeRequired: true,
    statuses: [
      "not_connected",
      "connected_unvalidated",
      "validated",
      "image_generation_available",
      "provider_billing_required",
      "provider_quota_unavailable",
      "platform_credits_not_configured",
    ],
    freePlanCopy:
      "Free plan users can use mock image generation while Stability provider calls remain disabled.",
    byokCopy:
      "Stability BYOK depends on the user's own Stability account, quota, and billing eligibility.",
    paidPlanCopy:
      "Future paid Free AI Mixer plans may use platform-owned Stability access after credits and subscriptions are implemented.",
    unavailableCopy:
      "Stability image generation remains unavailable until provider access and future execution routing are approved.",
  },
  {
    providerId: "replicate",
    displayName: "Replicate",
    supportsText: false,
    supportsImage: true,
    supportsVideo: true,
    byokSupported: true,
    platformPaidSupported: true,
    freeApiQuotaKnown: false,
    billingMayBeRequired: true,
    statuses: [
      "not_connected",
      "connected_unvalidated",
      "validated",
      "image_generation_available",
      "video_generation_available",
      "provider_billing_required",
      "provider_quota_unavailable",
      "platform_credits_not_configured",
    ],
    freePlanCopy:
      "Free plan users can use mock/demo generation while Replicate provider calls remain disabled.",
    byokCopy:
      "Replicate BYOK depends on the user's own Replicate account, quota, and billing eligibility.",
    paidPlanCopy:
      "Future paid Free AI Mixer plans may use platform-owned Replicate access after billing controls exist.",
    unavailableCopy:
      "Replicate generation remains unavailable until provider access and future execution routing are approved.",
  },
];

export const launchBlockRoadmap: LaunchBlockRoadmapItem[] = [
  {
    blockId: "Block 0",
    title: "Provider Capability + Free/Paid Policy",
    summary: "Honest provider capability, BYOK, mock/demo, and future paid platform-credit policy.",
  },
  {
    blockId: "Block 1",
    title: "Production Auth + Supabase Persistence",
    summary: "Production auth, workspace authority, and durable persistence readiness.",
  },
  {
    blockId: "Block 2",
    title: "Production Storage + Artifact Delivery",
    summary: "Private storage, backend-mediated artifact delivery, and preview/download policy.",
  },
  {
    blockId: "Block 3",
    title: "Billing / Credits / Subscriptions",
    summary: "Platform credits, subscriptions, and billing controls for paid Free AI Mixer generation.",
  },
  {
    blockId: "Block 4",
    title: "Real Provider Generation",
    summary: "Real image generation through approved BYOK or platform-paid provider routes.",
  },
  {
    blockId: "Block 5",
    title: "Real Video Generation",
    summary: "Verified video provider execution, storage, and truthful lifecycle delivery.",
  },
  {
    blockId: "Block 6",
    title: "Production Deployment",
    summary: "Production environment, monitoring, storage, and operational deployment readiness.",
  },
  {
    blockId: "Block 7",
    title: "Final Launch QA / Private Beta / Public Launch",
    summary: "Final launch QA, private beta gates, and explicit public launch go/no-go.",
  },
];

export const getProviderCapabilityPolicy = (
  providerId: SupportedProviderId,
): ProviderCapabilityPolicy | undefined =>
  providerCapabilityPolicies.find((policy) => policy.providerId === providerId);
