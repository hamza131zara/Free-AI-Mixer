import { create } from "zustand";
import {
  ImageGenerationAgentError,
  imageGenerationAgent,
} from "../agents/imageGenerationAgent";
import { ImageGenerationServiceError } from "../services/imageGenerationService";
import type {
  PromptImageGenerationError,
  PromptVideoGenerationLifecycle,
} from "../types/imageGeneration";

export interface VideoGenerationStoreState {
  lifecycle: PromptVideoGenerationLifecycle;
  prompt: string;
  error?: PromptImageGenerationError;
  status?: string;
  statusMessage?: string;
  lifecycleTrace: string[];
  providerId?: string;
  vendorCallsEnabled?: boolean;
  updatePrompt: (prompt: string) => void;
  generateVideoMetadata: () => Promise<void>;
  resetVideoGeneration: () => void;
}

let activeController: AbortController | undefined;

export const useVideoGenerationStore = create<VideoGenerationStoreState>(
  (set, get) => ({
    error: undefined,
    lifecycle: "idle",
    lifecycleTrace: [],
    prompt: "",
    providerId: undefined,
    status: undefined,
    statusMessage: undefined,
    vendorCallsEnabled: undefined,
    generateVideoMetadata: async () => {
      if (get().lifecycle === "submitting" || get().lifecycle === "processing") {
        return;
      }

      const controller = new AbortController();
      activeController = controller;
      set({
        error: undefined,
        lifecycle: "submitting",
        lifecycleTrace: ["submitted"],
        providerId: "mock_local",
        status: undefined,
        statusMessage: "Submitting mock video request to backend.",
        vendorCallsEnabled: false,
      });

      try {
        const result = await imageGenerationAgent.generateVideoMetadata(
          get().prompt,
          controller.signal,
        );

        if (
          result.response.kind === "generation_job_rejected" &&
          result.response.lifecycle === "processing"
        ) {
          set({
            lifecycle: "processing",
            lifecycleTrace: result.response.lifecycleTrace ?? [
              "submitted",
              "processing",
            ],
            providerId: result.response.attemptedProviderIds?.[0] ?? "mock_local",
            status: result.response.status,
            statusMessage: result.response.message,
            vendorCallsEnabled:
              result.response.runtime?.vendorCallsEnabled ?? false,
          });
          return;
        }

        if (result.response.kind === "generation_job_metadata_ready") {
          set({
            error: undefined,
            lifecycle: "metadata_ready",
            lifecycleTrace: ["submitted", "processing", "metadata_ready"],
            providerId: result.response.attemptedProviderIds[0] ?? "mock_local",
            status: result.response.status,
            statusMessage:
              "Backend returned verified video metadata. Delivery remains unavailable.",
            vendorCallsEnabled: result.response.runtime.vendorCallsEnabled,
          });
          return;
        }

        set({
          error: {
            code: result.response.status,
            message: result.response.message,
          },
          lifecycle:
            result.response.lifecycle === "processing"
              ? "processing"
              : result.response.lifecycle === "metadata_ready"
                ? "metadata_ready"
                : "failed",
          lifecycleTrace: result.response.lifecycleTrace ?? [
            "submitted",
            "processing",
            "failed",
          ],
          providerId: result.response.attemptedProviderIds?.[0] ?? "mock_local",
          status: result.response.status,
          statusMessage: result.response.message,
          vendorCallsEnabled: result.response.runtime?.vendorCallsEnabled ?? false,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        set({
          error: toVideoGenerationError(error),
          lifecycle: "failed",
          lifecycleTrace: ["submitted", "failed"],
          providerId: "mock_local",
          status: "generation_failed",
          statusMessage: "Mock video generation request failed safely.",
          vendorCallsEnabled: false,
        });
      } finally {
        if (activeController === controller) {
          activeController = undefined;
        }
      }
    },
    resetVideoGeneration: () => {
      activeController?.abort();
      activeController = undefined;
      set({
        error: undefined,
        lifecycle: "idle",
        lifecycleTrace: [],
        providerId: undefined,
        status: undefined,
        statusMessage: undefined,
        vendorCallsEnabled: undefined,
      });
    },
    updatePrompt: (prompt) => {
      set({
        prompt,
        ...(get().lifecycle === "failed"
          ? {
              error: undefined,
              lifecycle: "idle" as const,
              lifecycleTrace: [],
              status: undefined,
              statusMessage: undefined,
            }
          : {}),
      });
    },
  }),
);

const toVideoGenerationError = (error: unknown): PromptImageGenerationError => {
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
    message: "Mock video generation failed unexpectedly.",
  };
};
