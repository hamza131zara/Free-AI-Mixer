import {
  imageGenerationService,
  type ImageGenerationService,
} from "../services/imageGenerationService";
import type {
  PromptImageGenerationRequest,
  PromptImageGenerationResponse,
} from "../types/imageGeneration";

export class ImageGenerationAgentError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ImageGenerationAgentError";
    this.code = code;
  }
}

export interface ImageGenerationAgent {
  generateImageMetadata(
    prompt: string,
    signal?: AbortSignal,
  ): Promise<PromptImageGenerationResponse>;
}

export const createImageGenerationAgent = (
  service: ImageGenerationService = imageGenerationService,
): ImageGenerationAgent => ({
  async generateImageMetadata(prompt, signal) {
    return service.generateImageMetadata(createPromptImageRequest(prompt), signal);
  },
});

export const imageGenerationAgent = createImageGenerationAgent();

const createPromptImageRequest = (prompt: string): PromptImageGenerationRequest => {
  const normalizedPrompt = prompt.trim();

  if (!normalizedPrompt) {
    throw new ImageGenerationAgentError(
      "Enter a prompt before generating image metadata.",
      "invalid_prompt",
    );
  }

  return {
    generationKind: "image",
    prompt: normalizedPrompt,
    providerId: "openai",
    requestId: createSafeRequestId(),
  };
};

const createSafeRequestId = (): string => {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `img_${Date.now().toString(36)}_${randomId.replace(/[^A-Za-z0-9_-]/g, "")}`.slice(
    0,
    80,
  );
};
