import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  PromptImageArtifactMetadata,
} from "../types/imageGeneration";
import {
  getProjectImageGenerationHistory,
  type ProjectScopedImageHistoryEntry,
} from "../services/imageGenerationService";

export interface ImageGenerationHistoryStoreState {
  entries: ProjectScopedImageHistoryEntry[];
  historyStatus: "idle" | "loading" | "loaded" | "empty" | "unavailable";
  historyMessage?: string;
  addSuccessfulGeneration: (input: {
    artifact: PromptImageArtifactMetadata;
    prompt: string;
    projectId?: string;
    requestId: string;
  }) => void;
  clearGenerationHistory: () => void;
  loadProjectHistory: (projectId: string) => Promise<void>;
}

const imageGenerationHistoryPersistKey =
  "free-ai-mixer-image-generation-history";
const maxHistoryEntries = 25;

export const useImageGenerationHistoryStore =
  create<ImageGenerationHistoryStoreState>()(
    persist(
      (set) => ({
        entries: [],
        historyMessage: undefined,
        historyStatus: "idle",
        addSuccessfulGeneration: ({ artifact, prompt, projectId, requestId }) => {
          const entry: ProjectScopedImageHistoryEntry = {
            generationId: artifact.artifactId,
            requestId,
            prompt: prompt.trim(),
            providerId: artifact.providerId,
            contentType: artifact.contentType,
            sizeBytes: artifact.sizeBytes,
            createdAt: artifact.createdAt,
            deliveryStatus: artifact.deliveryStatus,
            ...(artifact.previewPath ? { previewPath: artifact.previewPath } : {}),
            projectId: projectId ?? "local-browser-only",
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
            historyStatus: "loaded",
          }));
        },
        clearGenerationHistory: () => {
          set({ entries: [], historyMessage: undefined, historyStatus: "idle" });
        },
        loadProjectHistory: async (projectId) => {
          set({
            historyMessage: "Loading durable project image history.",
            historyStatus: "loading",
          });

          const result = await getProjectImageGenerationHistory(projectId);

          if (result.kind === "history") {
            set({
              entries: result.entries,
              historyMessage: result.message,
              historyStatus: result.entries.length === 0 ? "empty" : "loaded",
            });
            return;
          }

          set({
            entries: [],
            historyMessage: result.message,
            historyStatus: "unavailable",
          });
        },
      }),
      {
        name: imageGenerationHistoryPersistKey,
        partialize: () => ({
          entries: [],
          historyMessage: undefined,
          historyStatus: "idle",
        }),
        storage: createJSONStorage(() => localStorage),
        version: 1,
      },
    ),
  );
