import type { ProviderCapability } from "../types/providerSettings";

export const providerCapabilityLabels: Record<ProviderCapability, string> = {
  image_generation: "Image generation",
  video_generation: "Video generation",
  native_video_audio: "Native video audio",
  text_to_speech: "Text to speech",
  music_generation: "Music generation",
  sound_effects: "Sound effects",
  upscale: "Upscale",
  template_generation_candidate: "Template candidate",
};
