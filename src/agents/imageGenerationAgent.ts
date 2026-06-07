import {
  imageGenerationService,
  type ImageGenerationService,
} from "../services/imageGenerationService";
import type {
  PromptImageGenerationRequest,
  PromptImageGenerationResponse,
  PromptVideoGenerationRequest,
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
  ): Promise<{
    request: PromptImageGenerationRequest;
    response: PromptImageGenerationResponse;
  }>;
  generateVideoMetadata(
    prompt: string,
    signal?: AbortSignal,
  ): Promise<{
    request: PromptVideoGenerationRequest;
    response: PromptImageGenerationResponse;
  }>;
}

export const createImageGenerationAgent = (
  service: ImageGenerationService = imageGenerationService,
): ImageGenerationAgent => ({
  async generateImageMetadata(prompt, signal) {
    const request = createPromptImageRequest(prompt);

    return {
      request,
      response: await service.generateImageMetadata(request, signal),
    };
  },
  async generateVideoMetadata(prompt, signal) {
    const request = createPromptVideoRequest(prompt);

    return {
      request,
      response: await service.generateVideoMetadata(request, signal),
    };
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

const createPromptVideoRequest = (prompt: string): PromptVideoGenerationRequest => {
  const normalizedPrompt = prompt.trim();

  if (!normalizedPrompt) {
    throw new ImageGenerationAgentError(
      "Enter a prompt before requesting mock video generation.",
      "invalid_prompt",
    );
  }

  return {
    generationKind: "video",
    prompt: normalizedPrompt,
    providerId: "mock_local",
    requestId: createSafeRequestId("vid"),
  };
};

const createSafeRequestId = (prefix = "img"): string => {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${prefix}_${Date.now().toString(36)}_${randomId.replace(/[^A-Za-z0-9_-]/g, "")}`.slice(
    0,
    80,
  );
};
