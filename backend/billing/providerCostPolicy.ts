export type ProviderCostSurface =
  | "image_generation"
  | "video_generation"
  | "artifact_storage"
  | "artifact_delivery";

export interface ProviderCostEstimate {
  providerId: "openai" | "gemini" | "imagen" | "veo" | "runway" | "pika" | "mock_local";
  surface: ProviderCostSurface;
  unit: "provider_billed_request" | "provider_billed_second" | "storage_byte_month";
  estimateState: "draft_only" | "provider_billing_required" | "platform_credits_not_configured";
  message: string;
}

export const providerCostPolicy: ProviderCostEstimate[] = [
  {
    providerId: "openai",
    surface: "image_generation",
    unit: "provider_billed_request",
    estimateState: "provider_billing_required",
    message:
      "OpenAI image generation cost depends on the provider account, model access, quota, and billing status.",
  },
  {
    providerId: "gemini",
    surface: "image_generation",
    unit: "provider_billed_request",
    estimateState: "provider_billing_required",
    message:
      "Gemini/Imagen image generation cost depends on the provider account, quota, and billing status.",
  },
  {
    providerId: "veo",
    surface: "video_generation",
    unit: "provider_billed_second",
    estimateState: "provider_billing_required",
    message:
      "Veo video generation cost depends on provider account eligibility, quota, and billing status.",
  },
  {
    providerId: "mock_local",
    surface: "image_generation",
    unit: "provider_billed_request",
    estimateState: "platform_credits_not_configured",
    message:
      "Mock/local generation does not call paid providers and must not be described as platform-paid generation.",
  },
];
