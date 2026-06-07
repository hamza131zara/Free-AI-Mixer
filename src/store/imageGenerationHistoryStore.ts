import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  PromptImageArtifactMetadata,
  PromptImageGenerationHistoryEntry,
} from "../types/imageGeneration";

export interface ImageGenerationHistoryStoreState {
  entries: PromptImageGenerationHistoryEntry[];
  addSuccessfulGeneration: (input: {
    artifact: PromptImageArtifactMetadata;
    prompt: string;
    requestId: string;
  }) => void;
  clearGenerationHistory: () => void;
}

const imageGenerationHistoryPersistKey =
  "free-ai-mixer-image-generation-history";
const maxHistoryEntries = 25;

export const useImageGenerationHistoryStore =
  create<ImageGenerationHistoryStoreState>()(
    persist(
      (set) => ({
        entries: [],
        addSuccessfulGeneration: ({ artifact, prompt, requestId }) => {
          const entry: PromptImageGenerationHistoryEntry = {
            generationId: artifact.artifactId,
            requestId,
            prompt: prompt.trim(),
            providerId: artifact.providerId,
            contentType: artifact.contentType,
            sizeBytes: artifact.sizeBytes,
            createdAt: artifact.createdAt,
            deliveryStatus: artifact.deliveryStatus,
            sha256: artifact.sha256,
            status: "metadata_ready",
          };

          set((state) => ({
            entries: [
              entry,
              ...state.entries.filter(
                (item) => item.generationId !== entry.generationId,
              ),
            ].slice(0, maxHistoryEntries),
          }));
        },
        clearGenerationHistory: () => {
          set({ entries: [] });
        },
      }),
      {
        name: imageGenerationHistoryPersistKey,
        storage: createJSONStorage(() => localStorage),
        version: 1,
      },
    ),
  );
