import {
  imageGenerationService,
  type ImageGenerationService,
  type ProjectScopedPromptImageGenerationRequest,
} from "../services/imageGenerationService";
import type {
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
    projectId: string,
    signal?: AbortSignal,
  ): Promise<{
    request: ProjectScopedPromptImageGenerationRequest;
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
  async generateImageMetadata(prompt, projectId, signal) {
    const request = createPromptImageRequest(prompt, projectId);

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

const createPromptImageRequest = (
  prompt: string,
  projectId: string,
): ProjectScopedPromptImageGenerationRequest => {
  const normalizedPrompt = prompt.trim();
  const normalizedProjectId = projectId.trim();

  if (!normalizedPrompt) {
    throw new ImageGenerationAgentError(
      "Enter a prompt before generating image metadata.",
      "invalid_prompt",
    );
  }

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalizedProjectId,
    )
  ) {
    throw new ImageGenerationAgentError(
      "Select a verified project before generating image metadata.",
      "invalid_project_id",
    );
  }

  return {
    generationKind: "image",
    prompt: normalizedPrompt,
    projectId: normalizedProjectId,
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
