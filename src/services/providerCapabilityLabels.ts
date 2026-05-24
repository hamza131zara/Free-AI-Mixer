import type { ProviderCapability } from "../types/providerSettings";

export const providerCapabilityLabels: Record<ProviderCapability, string> = {
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
