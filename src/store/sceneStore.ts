import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  SceneGenerationAgentError,
  sceneGenerationAgent,
} from "../agents/sceneGenerationAgent";
import { sceneQueueAgent } from "../agents/sceneQueueAgent";
import { SceneGenerationServiceError } from "../services/sceneGenerationService";
import type {
  GeneratedScene,
  SceneGenerationDraft,
  SceneGenerationError,
  SceneLifecycle,
  SceneProvider,
  SceneRecord,
} from "../types/scene";
import {
  assertLifecycleTransition,
  isGeneratingScene,
} from "./sceneLifecycle";

export interface SceneStoreState {
  hasHydrated: boolean;
  hydrationError?: string;
  draft: SceneGenerationDraft;
  scenes: SceneRecord[];
  composerError?: SceneGenerationError;
  isGeneratingAll: boolean;
  setHydrationStatus: (
    hasHydrated: boolean,
    hydrationError?: string,
  ) => void;
  updateDraft: (draft: Partial<SceneGenerationDraft>) => void;
  addSceneFromDraft: () => void;
  generateScene: (sceneId: string) => Promise<void>;
  retryScene: (sceneId: string) => Promise<void>;
  selectVariation: (sceneId: string, variation: string) => void;
  removeScene: (sceneId: string) => void;
  clearTerminalScenes: () => void;
  generateAll: () => Promise<void>;
}

let activeRunController: AbortController | undefined;

type PersistedSceneStoreState = Pick<SceneStoreState, "draft" | "scenes">;

const defaultDraft: SceneGenerationDraft = {
  prompt: "",
  style: "",
  duration: "",
};

const sceneStorePersistKey = "free-ai-mixer-scenes";

export const useSceneStore = create<SceneStoreState>()(
  persist(
    (set, get) => {
      const canMutateState = (): boolean => {
        const { hasHydrated, hydrationError } = get();
        return hasHydrated && !hydrationError;
      };

      const patchScene = (
        sceneId: string,
        patch: Partial<SceneRecord>,
      ): void => {
        set((state) => ({
          scenes: state.scenes.map((scene) =>
            scene.id === sceneId ? { ...scene, ...patch } : scene,
          ),
        }));
      };

      const transitionScene = (
        sceneId: string,
        lifecycle: SceneLifecycle,
        patch: Partial<SceneRecord> = {},
      ): void => {
        set((state) => ({
          scenes: state.scenes.map((scene) => {
            if (scene.id !== sceneId) {
              return scene;
            }

            assertLifecycleTransition(scene.lifecycle, lifecycle);

            const now = new Date().toISOString();
            const lifecyclePatch: Partial<SceneRecord> = { lifecycle };

            if (lifecycle === "queued") {
              lifecyclePatch.progress = 0;
              lifecyclePatch.queuedAt = now;
              lifecyclePatch.startedAt = undefined;
              lifecyclePatch.completedAt = undefined;
              lifecyclePatch.provider = undefined;
              lifecyclePatch.result = undefined;
              lifecyclePatch.selectedVariation = undefined;
              lifecyclePatch.error = undefined;
            }

            if (lifecycle === "generating") {
              lifecyclePatch.startedAt = now;
            }

            if (lifecycle === "success") {
              lifecyclePatch.progress = 100;
              lifecyclePatch.completedAt = now;
              lifecyclePatch.error = undefined;
            }

            if (lifecycle === "error") {
              lifecyclePatch.progress = 0;
              lifecyclePatch.completedAt = now;
            }

            return {
              ...scene,
              ...lifecyclePatch,
              ...patch,
            };
          }),
        }));
      };

      const setSceneProvider = (
        sceneId: string,
        provider: SceneProvider,
      ): void => {
        patchScene(sceneId, { provider });
      };

      const setSceneProgress = (sceneId: string, progress: number): void => {
        patchScene(sceneId, { progress });
      };

      const queueScene = (sceneId: string): void => {
        const scene = get().scenes.find((item) => item.id === sceneId);
        if (!scene) {
          return;
        }

        if (scene.lifecycle === "queued") {
          patchScene(sceneId, { progress: 0 });
          return;
        }

        transitionScene(sceneId, "queued");
      };

      const setSceneResult = (
        sceneId: string,
        result: GeneratedScene,
        provider: SceneProvider,
      ): void => {
        transitionScene(sceneId, "success", {
          result,
          provider,
        });
      };

      const setSceneError = (sceneId: string, error: unknown): void => {
        transitionScene(sceneId, "error", {
          error: toSceneGenerationError(error),
        });
      };

      const runQueuedJobs = async (
        jobs: { id: string; payload: SceneRecord["payload"] }[],
      ): Promise<void> => {
        if (!canMutateState() || jobs.length === 0 || get().isGeneratingAll) {
          return;
        }

        const uniqueJobs = jobs.filter(
          (job, index, collection) =>
            collection.findIndex((item) => item.id === job.id) === index,
        );

        uniqueJobs.forEach((job) => {
          console.log("[Store] Generating scene:", job.id);
        });

        const controller = new AbortController();
        activeRunController = controller;
        set({ isGeneratingAll: true, composerError: undefined });

        try {
          await sceneQueueAgent.generateAll(
            uniqueJobs,
            {
              onQueued: queueScene,
              onGenerating: (sceneId) =>
                transitionScene(sceneId, "generating"),
              onProgress: setSceneProgress,
              onProviderChange: setSceneProvider,
              onProviderFallback: setSceneProvider,
              onSuccess: setSceneResult,
              onError: setSceneError,
            },
            controller.signal,
          );
        } finally {
          if (activeRunController === controller) {
            activeRunController = undefined;
            set({ isGeneratingAll: false });
          }
        }
      };

      return {
        hasHydrated: false,
        hydrationError: undefined,
        draft: defaultDraft,
        scenes: [],
        isGeneratingAll: false,
        setHydrationStatus: (hasHydrated, hydrationError) => {
          set({
            hasHydrated,
            hydrationError,
          });
        },
        updateDraft: (draft) => {
          if (!canMutateState()) {
            return;
          }

          set((state) => ({
            draft: {
              ...state.draft,
              ...draft,
            },
            composerError: undefined,
          }));
        },
        addSceneFromDraft: () => {
          if (!canMutateState()) {
            return;
          }

          try {
            const payload = sceneGenerationAgent.createPayload(get().draft);
            const now = new Date().toISOString();

            set((state) => ({
              scenes: [
                ...state.scenes,
                {
                  id: crypto.randomUUID(),
                  lifecycle: "idle",
                  payload,
                  progress: 0,
                  createdAt: now,
                },
              ],
              draft: {
                ...state.draft,
                prompt: "",
              },
              composerError: undefined,
            }));
          } catch (error) {
            set({ composerError: toSceneGenerationError(error) });
          }
        },
        generateScene: async (sceneId) => {
          if (!canMutateState()) {
            return;
          }

          const scene = get().scenes.find((item) => item.id === sceneId);
          if (
            !scene ||
            isGeneratingScene(scene) ||
            (scene.lifecycle !== "idle" && scene.lifecycle !== "success")
          ) {
            return;
          }

          await runQueuedJobs([{ id: scene.id, payload: scene.payload }]);
        },
        retryScene: async (sceneId) => {
          if (!canMutateState()) {
            return;
          }

          const scene = get().scenes.find((item) => item.id === sceneId);
          if (!scene || scene.lifecycle !== "error") {
            return;
          }

          transitionScene(sceneId, "queued");
          await runQueuedJobs([{ id: scene.id, payload: scene.payload }]);
        },
        selectVariation: (sceneId, variation) => {
          if (!canMutateState()) {
            return;
          }

          const scene = get().scenes.find((item) => item.id === sceneId);
          if (!scene?.result?.variations.includes(variation)) {
            return;
          }

          patchScene(sceneId, { selectedVariation: variation });
        },
        removeScene: (sceneId) => {
          if (!canMutateState()) {
            return;
          }

          set((state) => ({
            scenes: state.scenes.filter((scene) => {
              if (scene.id !== sceneId) {
                return true;
              }

              return isGeneratingScene(scene);
            }),
          }));
        },
        clearTerminalScenes: () => {
          if (!canMutateState()) {
            return;
          }

          set((state) => ({
            scenes: state.scenes.filter(
              (scene) =>
                scene.lifecycle !== "success" && scene.lifecycle !== "error",
            ),
          }));
        },
        generateAll: async () => {
          if (!canMutateState()) {
            return;
          }

          const jobs = get()
            .scenes.filter(
              (scene) => scene.lifecycle === "idle" || scene.lifecycle === "error",
            )
            .map((scene) => ({
              id: scene.id,
              payload: scene.payload,
            }));

          await runQueuedJobs(jobs);
        },
      };
    },
    {
      name: sceneStorePersistKey,
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedSceneStoreState => ({
        draft: state.draft,
        scenes: state.scenes.map(sanitizeSceneForPersistence),
      }),
      merge: (persistedState, currentState): SceneStoreState => {
        const persisted = persistedState as Partial<PersistedSceneStoreState>;

        return {
          ...currentState,
          draft: persisted.draft ?? currentState.draft,
          scenes: persisted.scenes?.map(sanitizeSceneForPersistence) ?? [],
          hasHydrated: false,
          hydrationError: undefined,
          isGeneratingAll: false,
          composerError: undefined,
        };
      },
    },
  ),
);

useSceneStore.persist.onFinishHydration(() => {
  useSceneStore.setState({
    hasHydrated: true,
    hydrationError: undefined,
  });
});

if (useSceneStore.persist.hasHydrated()) {
  useSceneStore.setState({
    hasHydrated: true,
    hydrationError: undefined,
  });
} else if (
  typeof window !== "undefined" &&
  window.localStorage.getItem(sceneStorePersistKey) === null
) {
  useSceneStore.setState({
    hasHydrated: true,
    hydrationError: undefined,
  });
} else {
  const rehydrateResult = useSceneStore.persist.rehydrate();
  if (rehydrateResult instanceof Promise) {
    void rehydrateResult.catch((error: unknown) => {
      useSceneStore.setState({
        hasHydrated: false,
        hydrationError: error instanceof Error ? error.message : undefined,
      });
    });
  }
}

function sanitizeSceneForPersistence(scene: SceneRecord): SceneRecord {
  const sanitizedSelectedVariation =
    scene.result?.variations.includes(scene.selectedVariation ?? "") === true
      ? scene.selectedVariation
      : undefined;

  if (!isGeneratingScene(scene)) {
    return {
      ...scene,
      selectedVariation: sanitizedSelectedVariation,
    };
  }

  return {
    ...scene,
    lifecycle: "idle",
    progress: 0,
    provider: undefined,
    error: undefined,
    selectedVariation: sanitizedSelectedVariation,
    queuedAt: undefined,
    startedAt: undefined,
    completedAt: undefined,
  };
}

function toSceneGenerationError(error: unknown): SceneGenerationError {
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      message: "Scene generation was aborted.",
      code: "aborted",
    };
  }

  if (error instanceof SceneGenerationServiceError) {
    return {
      message: error.message,
      code: error.code,
      details: {
        provider: error.provider,
        cause: error.details,
      },
    };
  }

  if (error instanceof SceneGenerationAgentError) {
    return {
      message: error.message,
      code: error.code,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: "unexpected_error",
    };
  }

  return {
    message: "Scene generation failed unexpectedly.",
    code: "unknown_error",
    details: error,
  };
}
