import type { BackendCreditPolicySummary } from "../contracts/creditsHttpTypes";

export const draftCreditCostEstimates: BackendCreditPolicySummary["draftEstimates"] = [
  {
    id: "simple_image_scene",
    label: "Simple image scene",
    creditRangeLabel: "50-100 credits",
  },
  {
    id: "image_template_transformation",
    label: "Image template transformation",
    creditRangeLabel: "75-125 credits",
  },
  {
    id: "short_video_scene",
    label: "Short video scene (3-5 sec)",
    creditRangeLabel: "250-400 credits",
  },
  {
    id: "medium_video_scene",
    label: "Medium video scene (8-10 sec)",
    creditRangeLabel: "500-800 credits",
  },
  {
    id: "final_render_export",
    label: "Final render/export",
    creditRangeLabel: "150-300 credits",
  },
  {
    id: "storage_download_orchestration",
    label: "Storage/download/orchestration event",
    creditRangeLabel: "10-25 credits",
  },
  {
    id: "full_short_video_flow",
    label: "Full short video flow",
    creditRangeLabel: "500-800 credits",
  },
  {
    id: "full_medium_video_flow",
    label: "Full medium video flow",
    creditRangeLabel: "900-1500 credits",
  },
];

export const defaultCreditPolicy: BackendCreditPolicySummary = {
  freeByokDailyCreditsLater: 2500,
  providerCostOwner: "user_api_key",
  walletScope: "workspace",
  sharedWalletSurfaces: ["mixer", "templates", "exports", "downloads"],
  multipleApiKeysMultiplyCredits: false,
  multipleProvidersMultiplyCredits: false,
  creditsEnabled: false,
  billingEnabled: false,
  policyNotes: [
    "Free BYOK users may later get 2500 daily Free AI Mixer platform credits.",
    "User pays provider generation cost through their own API keys in BYOK mode.",
    "Free AI Mixer platform credits meter platform usage, orchestration, storage, render, and downloads.",
    "Multiple API keys do not multiply daily platform credits.",
    "Multiple providers only increase routing and fallback options.",
    "Jobs should reserve credits first, then settle, release, or refund after truthful provider or render results.",
    "Credits and billing are not enabled yet.",
    "Prices and credit estimates are draft planning only, not final business commitments.",
  ],
  draftEstimates: draftCreditCostEstimates,
};
