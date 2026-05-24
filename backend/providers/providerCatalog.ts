import type {
  BackendProviderCapability,
  BackendProviderCatalogEntry,
} from "../contracts/providerSettingsHttpTypes";

const providerCatalog = [
  {
    id: "openai",
    displayName: "OpenAI",
    capabilities: [
      "image_generation",
      "image_editing",
      "video_generation",
      "prompt_text_intelligence",
      "template_generation_candidate",
      "card_generation_candidate",
    ],
    supportsByok: true,
    summary:
      "General-purpose multimodal provider candidate for image workflows, prompt intelligence, and future video readiness.",
    officialWebsite: "https://openai.com",
    docsUrl: "https://platform.openai.com/docs",
    securityNote:
      "API keys must remain backend-managed later and must never be stored in the browser or shown again after submission.",
    costNote:
      "Provider cost comes from the user’s own OpenAI account balance or trial credits when BYOK is enabled later.",
    platformLimitNote:
      "Free AI Mixer platform credits remain separate from OpenAI account usage and do not multiply when more keys are added.",
    status: "available",
  },
  {
    id: "runway",
    displayName: "Runway",
    capabilities: [
      "video_generation",
      "text_to_video",
      "image_to_video",
      "video_to_video",
      "audio_generation",
    ],
    supportsByok: true,
    summary:
      "Video-first provider candidate for future text-to-video, image-to-video, and motion fallback routing.",
    officialWebsite: "https://runwayml.com",
    docsUrl: "https://docs.dev.runwayml.com",
    securityNote:
      "Future BYOK routing must keep Runway keys encrypted backend-side and must not leak provider-side error detail to the client.",
    costNote:
      "Runway usage cost stays on the user’s own Runway account when BYOK is enabled later.",
    platformLimitNote:
      "Free AI Mixer platform limits will remain separate from Runway account credits or subscription allowances.",
    status: "available",
  },
  {
    id: "luma",
    displayName: "Luma",
    capabilities: [
      "video_generation",
      "text_to_video",
      "image_to_video",
    ],
    supportsByok: true,
    summary:
      "Video and motion generation candidate focused on cinematic text-to-video and image-to-video flows.",
    officialWebsite: "https://lumalabs.ai",
    docsUrl: "https://lumalabs.ai/dream-machine",
    securityNote:
      "Future Luma key handling must stay backend-only and must not expose raw credentials or provider-specific validation responses.",
    costNote:
      "Luma usage later comes from the user’s own provider account rather than any Free AI Mixer platform credit grant.",
    platformLimitNote:
      "Platform limits and orchestration credits stay separate from Luma provider usage.",
    status: "available",
  },
  {
    id: "google",
    displayName: "Google Gemini/Veo",
    capabilities: [
      "image_generation",
      "video_generation",
      "text_to_video",
      "image_to_video",
      "prompt_text_intelligence",
      "text_to_speech",
    ],
    supportsByok: true,
    summary:
      "Gemini and Veo family candidate for future multimodal prompting, video generation, and assistant-style routing.",
    officialWebsite: "https://ai.google.dev",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    securityNote:
      "Google provider credentials must later be accepted only through verified backend auth and never persisted in the browser.",
    costNote:
      "Provider usage later follows the user’s own Google billing or trial arrangement, not a Free AI Mixer credit grant.",
    platformLimitNote:
      "Adding Google keys expands routing options but does not increase the platform’s daily credit allowance.",
    status: "available",
  },
  {
    id: "stability",
    displayName: "Stability",
    capabilities: [
      "image_generation",
      "image_editing",
      "template_generation_candidate",
      "card_generation_candidate",
    ],
    supportsByok: true,
    summary:
      "Image-focused provider candidate for future template and card image workflows plus editing-ready use cases.",
    officialWebsite: "https://stability.ai",
    docsUrl: "https://platform.stability.ai/docs",
    securityNote:
      "Future Stability API keys must remain encrypted backend-side and must not be echoed into logs, analytics, or UI state.",
    costNote:
      "Stability costs later come from the user’s own provider balance or plan through BYOK.",
    platformLimitNote:
      "Platform credits remain a separate Free AI Mixer meter even when Stability is configured.",
    status: "available",
  },
  {
    id: "replicate",
    displayName: "Replicate",
    capabilities: [
      "model_marketplace",
      "image_generation",
      "video_generation",
      "image_to_video",
      "text_to_video",
    ],
    supportsByok: true,
    summary:
      "Model marketplace candidate that can widen future routing options depending on the chosen model family.",
    officialWebsite: "https://replicate.com",
    docsUrl: "https://replicate.com/docs",
    securityNote:
      "Replicate key handling later must stay backend-only and should not expose model-specific failure detail that could reveal account state.",
    costNote:
      "Replicate charges later come from the user’s own Replicate account and selected model pricing.",
    platformLimitNote:
      "Replicate keys add capabilities and fallback choices only; they do not multiply Free AI Mixer platform credits.",
    status: "available",
  },
] satisfies BackendProviderCatalogEntry[];

export const providerCapabilityLabels: Record<BackendProviderCapability, string> = {
  image_generation: "Image generation",
  image_editing: "Image editing",
  video_generation: "Video generation",
  image_to_video: "Image to video",
  text_to_video: "Text to video",
  video_to_video: "Video to video",
  audio_generation: "Audio generation",
  text_to_speech: "Text to speech",
  template_generation_candidate: "Template candidate",
  card_generation_candidate: "Card candidate",
  prompt_text_intelligence: "Prompt and text intelligence",
  model_marketplace: "Model marketplace",
};

export const getProviderCatalog = (): BackendProviderCatalogEntry[] => providerCatalog;
