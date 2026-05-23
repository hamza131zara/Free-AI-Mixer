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
      "video_generation",
      "native_video_audio",
      "text_to_speech",
      "sound_effects",
      "upscale",
      "template_generation_candidate",
    ],
    supportsByok: true,
    summary:
      "General-purpose multimodal provider with strong image, video, speech, and routing flexibility potential.",
  },
  {
    id: "runway",
    displayName: "Runway",
    capabilities: [
      "image_generation",
      "video_generation",
      "native_video_audio",
      "sound_effects",
      "upscale",
      "template_generation_candidate",
    ],
    supportsByok: true,
    summary:
      "Video-first creative provider candidate for future routing and fallback decisions.",
  },
  {
    id: "luma",
    displayName: "Luma",
    capabilities: [
      "image_generation",
      "video_generation",
      "native_video_audio",
      "upscale",
      "template_generation_candidate",
    ],
    supportsByok: true,
    summary:
      "Video and motion generation provider candidate with future BYOK routing potential.",
  },
  {
    id: "google",
    displayName: "Google",
    capabilities: [
      "image_generation",
      "video_generation",
      "native_video_audio",
      "text_to_speech",
      "music_generation",
      "sound_effects",
      "template_generation_candidate",
    ],
    supportsByok: true,
    summary:
      "Gemini and Veo family candidate for future multimodal routing, audio, and assistant flows.",
  },
  {
    id: "stability",
    displayName: "Stability",
    capabilities: [
      "image_generation",
      "video_generation",
      "upscale",
      "template_generation_candidate",
    ],
    supportsByok: true,
    summary:
      "Image and media enhancement provider candidate for future generation and upscale routing.",
  },
  {
    id: "replicate",
    displayName: "Replicate",
    capabilities: [
      "image_generation",
      "video_generation",
      "music_generation",
      "sound_effects",
      "upscale",
      "template_generation_candidate",
    ],
    supportsByok: true,
    summary:
      "Broad model marketplace candidate that can widen future routing and fallback options.",
  },
] satisfies BackendProviderCatalogEntry[];

export const providerCapabilityLabels: Record<BackendProviderCapability, string> = {
  image_generation: "Image generation",
  video_generation: "Video generation",
  native_video_audio: "Native video audio",
  text_to_speech: "Text to speech",
  music_generation: "Music generation",
  sound_effects: "Sound effects",
  upscale: "Upscale",
  template_generation_candidate: "Template candidate",
};

export const getProviderCatalog = (): BackendProviderCatalogEntry[] => providerCatalog;
