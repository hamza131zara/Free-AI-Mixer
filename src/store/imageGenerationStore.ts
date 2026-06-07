import { create } from "zustand";
import {
  ImageGenerationAgentError,
  imageGenerationAgent,
} from "../agents/imageGenerationAgent";
import { ImageGenerationServiceError } from "../services/imageGenerationService";
import { useImageGenerationHistoryStore } from "./imageGenerationHistoryStore";
import type {
  PromptImageArtifactMetadata,
  PromptImageGenerationError,
  PromptImageGenerationLifecycle,
} from "../types/imageGeneration";

export interface ImageGenerationStoreState {
  lifecycle: PromptImageGenerationLifecycle;
  prompt: string;
  artifact?: PromptImageArtifactMetadata;
  error?: PromptImageGenerationError;
  statusMessage?: string;
  updatePrompt: (prompt: string) => void;
  generateImageMetadata: () => Promise<void>;
  resetImageGeneration: () => void;
}

let activeController: AbortController | undefined;

export const useImageGenerationStore = create<ImageGenerationStoreState>(
  (set, get) => ({
    artifact: undefined,
    error: undefined,
    lifecycle: "idle",
    prompt: "",
    statusMessage: undefined,
    generateImageMetadata: async () => {
      if (get().lifecycle === "submitting") {
        return;
      }

      const controller = new AbortController();
      activeController = controller;
      set({
        artifact: undefined,
        error: undefined,
        lifecycle: "submitting",
        statusMessage: "Submitting prompt to backend mock image generation.",
      });

      try {
        const result = await imageGenerationAgent.generateImageMetadata(
          get().prompt,
          controller.signal,
        );

        if (result.response.kind === "generation_job_metadata_ready") {
          const artifact = {
            ...result.response.artifact,
            previewPath: createGeneratedImagePreviewPath({
              artifactId: result.response.artifact.artifactId,
              requestId: result.request.requestId,
            }),
          };

          useImageGenerationHistoryStore
            .getState()
            .addSuccessfulGeneration({
              artifact,
              prompt: result.request.prompt,
              requestId: result.request.requestId,
            });

          set({
            artifact,
            error: undefined,
            lifecycle: "metadata_ready",
            statusMessage:
              "Backend returned verified local artifact metadata. Delivery remains unavailable.",
          });
          return;
        }

        set({
          artifact: undefined,
          error: {
            code: result.response.status,
            message: result.response.message,
          },
          lifecycle: "failed",
          statusMessage: "Image generation request failed safely.",
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        set({
          artifact: undefined,
          error: toImageGenerationError(error),
          lifecycle: "failed",
          statusMessage: "Image generation request failed safely.",
        });
      } finally {
        if (activeController === controller) {
          activeController = undefined;
        }
      }
    },
    resetImageGeneration: () => {
      activeController?.abort();
      activeController = undefined;
      set({
        artifact: undefined,
        error: undefined,
        lifecycle: "idle",
        statusMessage: undefined,
      });
    },
    updatePrompt: (prompt) => {
      set({
        prompt,
        ...(get().lifecycle === "failed"
          ? {
              error: undefined,
              lifecycle: "idle" as const,
              statusMessage: undefined,
            }
          : {}),
      });
    },
  }),
);

const toImageGenerationError = (error: unknown): PromptImageGenerationError => {
  if (
    error instanceof ImageGenerationAgentError ||
    error instanceof ImageGenerationServiceError
  ) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      code: "unexpected_error",
      message: error.message,
    };
  }

  return {
    code: "unknown_error",
    message: "Image generation failed unexpectedly.",
  };
};

const createGeneratedImagePreviewPath = ({
  artifactId,
  requestId,
}: {
  artifactId: string;
  requestId: string;
}): string =>
  `/generation/jobs/${encodeURIComponent(requestId)}/artifacts/${encodeURIComponent(artifactId)}/preview`;
