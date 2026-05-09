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
  SceneProviderJobState,
  SceneProvider,
  SceneRecord,
} from "../types/scene";
import {
  providerJobResumeVersion,
  type ProviderJobActiveStatus,
  type ProviderJobSubmission,
} from "../types/providerJob";
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
const activeSceneIds = new Set<string>();
let hydrationResumeScheduled = false;

type PersistedSceneStoreState = Pick<SceneStoreState, "draft" | "scenes">;

const defaultDraft: SceneGenerationDraft = {
  prompt: "",
  style: "",
  duration: "",
};

const sceneStorePersistKey = "free-ai-mixer-scenes";
const defaultProviderJobTimeoutMs = 30_000;

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
              lifecyclePatch.providerJob = undefined;
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

      const setSceneProviderJob = (
        sceneId: string,
        providerJob?: SceneProviderJobState,
      ): void => {
        patchScene(sceneId, { providerJob });
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
        const scene = get().scenes.find((item) => item.id === sceneId);
        if (!scene || scene.lifecycle === "success" || scene.lifecycle === "error") {
          return;
        }

        transitionScene(sceneId, "success", {
          result,
          provider,
          providerJob: scene.providerJob
            ? {
                ...scene.providerJob,
                status: "succeeded",
                label: "Completed after provider job",
              }
            : undefined,
        });
      };

      const setSceneError = (sceneId: string, error: unknown): void => {
        const scene = get().scenes.find((item) => item.id === sceneId);
        if (!scene || scene.lifecycle === "success" || scene.lifecycle === "error") {
          return;
        }

        const sceneError = toSceneGenerationError(error);
        transitionScene(sceneId, "error", {
          error: sceneError,
          providerJob: scene.providerJob
            ? {
                ...scene.providerJob,
                status:
                  sceneError.code === "provider_poll_timeout"
                    ? "timed_out"
                    : scene.providerJob.status,
                label:
                  sceneError.code === "provider_poll_timeout"
                    ? "Timed out while waiting for provider"
                    : "Failed during provider job",
              }
            : undefined,
        });
      };

      const toProviderJobState = (
        scene: SceneRecord,
        submission: ProviderJobSubmission,
        label: string,
        pollAttemptCount = 0,
      ): SceneProviderJobState => ({
        provider: submission.handle.provider,
        sceneId: scene.id,
        jobId: submission.handle.jobId,
        status: submission.handle.status,
        remoteStatus:
          submission.handle.metadata?.remoteStatus ?? submission.handle.status,
        submittedAt: scene.startedAt ?? new Date().toISOString(),
        lastPolledAt:
          pollAttemptCount > 0 ? new Date().toISOString() : undefined,
        pollAttemptCount,
        timeoutAt: createProviderJobTimeoutAt(scene.startedAt),
        requestFingerprint: createSceneRequestFingerprint(
          scene.payload,
          submission.handle.provider,
        ),
        resumeVersion: providerJobResumeVersion,
        resumeState: "runtime_active",
        label,
      });

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
        const runnableJobs = uniqueJobs.filter((job) => !activeSceneIds.has(job.id));

        if (runnableJobs.length === 0) {
          return;
        }

        runnableJobs.forEach((job) => {
          activeSceneIds.add(job.id);
        });

        runnableJobs.forEach((job) => {
          console.log("[Store] Generating scene:", job.id);
        });

        const controller = new AbortController();
        activeRunController = controller;
        set({ isGeneratingAll: true, composerError: undefined });

        try {
          await sceneQueueAgent.generateAll(
            runnableJobs,
            {
              onQueued: queueScene,
              onGenerating: (sceneId) =>
                transitionScene(sceneId, "generating"),
              onProgress: setSceneProgress,
              onProviderChange: setSceneProvider,
              onProviderFallback: setSceneProvider,
              onJobAccepted: (sceneId, submission) => {
                const scene = get().scenes.find((item) => item.id === sceneId);
                if (!scene) {
                  return;
                }

                setSceneProviderJob(
                  sceneId,
                  toProviderJobState(scene, submission, "Job accepted"),
                );
              },
              onJobPolling: (sceneId, submission, attempt) => {
                const scene = get().scenes.find((item) => item.id === sceneId);
                if (!scene) {
                  return;
                }

                setSceneProviderJob(
                  sceneId,
                  toProviderJobState(
                    scene,
                    submission,
                    "Polling provider job",
                    attempt,
                  ),
                );
              },
              onJobPending: (sceneId, submission, attempt) => {
                const scene = get().scenes.find((item) => item.id === sceneId);
                if (!scene) {
                  return;
                }

                setSceneProviderJob(
                  sceneId,
                  toProviderJobState(
                    scene,
                    submission,
                    attempt <= 1
                      ? "Waiting for provider"
                      : "Polling provider job",
                    attempt,
                  ),
                );
              },
              onJobTransientFailure: (sceneId, submission, attempt) => {
                const scene = get().scenes.find((item) => item.id === sceneId);
                if (!scene) {
                  return;
                }

                setSceneProviderJob(
                  sceneId,
                  toProviderJobState(
                    scene,
                    submission,
                    "Waiting for provider",
                    attempt,
                  ),
                );
              },
              onSuccess: setSceneResult,
              onError: setSceneError,
            },
            controller.signal,
          );
        } finally {
          runnableJobs.forEach((job) => {
            activeSceneIds.delete(job.id);
          });

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
          scenes: persisted.scenes?.map(classifyHydratedScene) ?? [],
          hasHydrated: false,
          hydrationError: undefined,
          isGeneratingAll: false,
          composerError: undefined,
        };
      },
    },
  ),
);

useSceneStore.subscribe((state) => {
  if (
    state.hasHydrated &&
    !state.hydrationError &&
    state.scenes.some(
      (scene) =>
        scene.lifecycle === "generating" &&
        isResumeNeededProviderJob(scene.providerJob) &&
        !activeSceneIds.has(scene.id),
    )
  ) {
    scheduleHydratedProviderJobResume();
  }
});

useSceneStore.persist.onFinishHydration(() => {
  useSceneStore.setState({
    hasHydrated: true,
    hydrationError: undefined,
  });
  scheduleHydratedProviderJobResume();
});

if (useSceneStore.persist.hasHydrated()) {
  useSceneStore.setState({
    hasHydrated: true,
    hydrationError: undefined,
  });
  scheduleHydratedProviderJobResume();
} else if (
  typeof window !== "undefined" &&
  window.localStorage.getItem(sceneStorePersistKey) === null
) {
  useSceneStore.setState({
    hasHydrated: true,
    hydrationError: undefined,
  });
  scheduleHydratedProviderJobResume();
} else {
  const rehydrateResult = useSceneStore.persist.rehydrate();
  if (rehydrateResult instanceof Promise) {
    void rehydrateResult
      .then(() => {
        scheduleHydratedProviderJobResume();
      })
      .catch((error: unknown) => {
        useSceneStore.setState({
          hasHydrated: false,
          hydrationError: error instanceof Error ? error.message : undefined,
        });
      });
  } else {
    scheduleHydratedProviderJobResume();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener(
    "load",
    () => {
      scheduleHydratedProviderJobResume();
    },
    { once: true },
  );
}

function scheduleHydratedProviderJobResume(): void {
  if (typeof window === "undefined" || hydrationResumeScheduled) {
    return;
  }

  hydrationResumeScheduled = true;
  window.setTimeout(() => {
    hydrationResumeScheduled = false;
    void resumeHydratedProviderJobsFromStore();
  }, 0);
}

async function resumeHydratedProviderJobsFromStore(): Promise<void> {
  const state = useSceneStore.getState();
  if (!state.hasHydrated || state.hydrationError) {
    return;
  }

  const resumableScenes = state.scenes.filter(
    (scene) =>
      scene.lifecycle === "generating" &&
      isResumeNeededProviderJob(scene.providerJob) &&
      !activeSceneIds.has(scene.id),
  );

  if (resumableScenes.length === 0) {
    return;
  }

  resumableScenes.forEach((scene) => {
    activeSceneIds.add(scene.id);
  });

  useSceneStore.setState((currentState) => ({
    ...currentState,
    isGeneratingAll: true,
    scenes: currentState.scenes.map((scene) => {
      if (!resumableScenes.some((candidate) => candidate.id === scene.id)) {
        return scene;
      }

      return {
        ...scene,
        provider: scene.providerJob?.provider ?? scene.provider,
        progress: Math.max(scene.progress, 70),
        providerJob: scene.providerJob
          ? {
              ...scene.providerJob,
              resumeState: "runtime_active",
              label: "Resuming provider job",
            }
          : undefined,
      };
    }),
  }));

  await Promise.all(
    resumableScenes.map(async (scene) => {
      const submission = toPersistedProviderJobSubmission(scene.providerJob);
      if (!submission) {
        activeSceneIds.delete(scene.id);
        setSceneErrorInStore(scene.id, {
          message: "Persisted provider job metadata could not be resumed safely.",
          code: "provider_job_resume_unavailable",
        });
        return;
      }

      const controller = new AbortController();
      activeRunController = controller;

      try {
        const result = await sceneGenerationAgent.resolveGeneration(
          submission,
          controller.signal,
          {
            onPollingAttempt: (_provider, attempt) => {
              patchProviderJobInStore(scene.id, (providerJob) => ({
                ...providerJob,
                status: submission.handle.status,
                remoteStatus:
                  providerJob.remoteStatus ?? submission.handle.status,
                lastPolledAt: new Date().toISOString(),
                pollAttemptCount: Math.max(providerJob.pollAttemptCount, attempt),
                resumeState: "runtime_active",
                label: "Polling provider job",
              }));
              setSceneProgressInStore(scene.id, 75);
            },
            onPollingPending: (_provider, attempt) => {
              patchProviderJobInStore(scene.id, (providerJob) => ({
                ...providerJob,
                status: submission.handle.status,
                remoteStatus:
                  providerJob.remoteStatus ?? submission.handle.status,
                lastPolledAt: new Date().toISOString(),
                pollAttemptCount: Math.max(providerJob.pollAttemptCount, attempt),
                resumeState: "runtime_active",
                label:
                  attempt <= 1 ? "Waiting for provider" : "Polling provider job",
              }));
              setSceneProgressInStore(scene.id, 80);
            },
            onPollingTransientFailure: (_provider, attempt) => {
              patchProviderJobInStore(scene.id, (providerJob) => ({
                ...providerJob,
                status: submission.handle.status,
                remoteStatus:
                  providerJob.remoteStatus ?? submission.handle.status,
                lastPolledAt: new Date().toISOString(),
                pollAttemptCount: Math.max(providerJob.pollAttemptCount, attempt),
                resumeState: "runtime_active",
                label: "Waiting for provider",
              }));
              setSceneProgressInStore(scene.id, 65);
            },
          },
        );

        setSceneResultInStore(scene.id, result.scene, result.provider);
      } catch (error) {
        setSceneErrorInStore(scene.id, error);
      } finally {
        activeSceneIds.delete(scene.id);

        if (activeRunController === controller) {
          activeRunController = undefined;
        }

        if (activeSceneIds.size === 0) {
          useSceneStore.setState((currentState) => ({
            ...currentState,
            isGeneratingAll: false,
          }));
        }
      }
    }),
  );
}

function patchSceneInStore(
  sceneId: string,
  patch: Partial<SceneRecord>,
): void {
  useSceneStore.setState((state) => ({
    ...state,
    scenes: state.scenes.map((scene) =>
      scene.id === sceneId ? { ...scene, ...patch } : scene,
    ),
  }));
}

function patchProviderJobInStore(
  sceneId: string,
  updater: (providerJob: SceneProviderJobState) => SceneProviderJobState,
): void {
  useSceneStore.setState((state) => ({
    ...state,
    scenes: state.scenes.map((scene) => {
      if (scene.id !== sceneId || !scene.providerJob) {
        return scene;
      }

      return {
        ...scene,
        providerJob: updater(scene.providerJob),
      };
    }),
  }));
}

function setSceneProgressInStore(sceneId: string, progress: number): void {
  patchSceneInStore(sceneId, { progress });
}

function setSceneResultInStore(
  sceneId: string,
  result: GeneratedScene,
  provider: SceneProvider,
): void {
  useSceneStore.setState((state) => ({
    ...state,
    scenes: state.scenes.map((scene) => {
      if (scene.id !== sceneId || scene.lifecycle === "success" || scene.lifecycle === "error") {
        return scene;
      }

      assertLifecycleTransition(scene.lifecycle, "success");

      return {
        ...scene,
        lifecycle: "success",
        progress: 100,
        completedAt: new Date().toISOString(),
        error: undefined,
        result,
        provider,
        providerJob: scene.providerJob
          ? {
              ...scene.providerJob,
              status: "succeeded",
              label: "Completed after provider job",
            }
          : undefined,
      };
    }),
  }));
}

function setSceneErrorInStore(sceneId: string, error: unknown): void {
  useSceneStore.setState((state) => ({
    ...state,
    scenes: state.scenes.map((scene) => {
      if (scene.id !== sceneId || scene.lifecycle === "success" || scene.lifecycle === "error") {
        return scene;
      }

      assertLifecycleTransition(scene.lifecycle, "error");

      const sceneError = toSceneGenerationError(error);

      return {
        ...scene,
        lifecycle: "error",
        progress: 0,
        completedAt: new Date().toISOString(),
        error: sceneError,
        providerJob: scene.providerJob
          ? {
              ...scene.providerJob,
              status:
                sceneError.code === "provider_poll_timeout"
                  ? "timed_out"
                  : scene.providerJob.status,
              label:
                sceneError.code === "provider_poll_timeout"
                  ? "Timed out while waiting for provider"
                  : "Failed during provider job",
            }
          : undefined,
      };
    }),
  }));
}

function sanitizeSceneForPersistence(scene: SceneRecord): SceneRecord {
  const sanitizedSelectedVariation =
    scene.result?.variations.includes(scene.selectedVariation ?? "") === true
      ? scene.selectedVariation
      : undefined;

  if (!isGeneratingScene(scene)) {
    return {
      ...scene,
      providerJob: scene.providerJob
        ? sanitizeProviderJobForPersistence(scene)
        : undefined,
      selectedVariation: sanitizedSelectedVariation,
    };
  }

  if (scene.lifecycle === "generating") {
    const sanitizedProviderJob = sanitizeProviderJobForPersistence(scene);
    if (sanitizedProviderJob) {
      return {
        ...scene,
        provider: sanitizedProviderJob.provider,
        providerJob: sanitizedProviderJob,
        error: undefined,
        selectedVariation: sanitizedSelectedVariation,
      };
    }
  }

  return {
    ...scene,
    lifecycle: "idle",
    progress: 0,
    provider: undefined,
    providerJob: undefined,
    error: undefined,
    selectedVariation: sanitizedSelectedVariation,
    queuedAt: undefined,
    startedAt: undefined,
    completedAt: undefined,
  };
}

function sanitizeProviderJobForPersistence(
  scene: SceneRecord,
): SceneProviderJobState | undefined {
  const providerJob = scene.providerJob;
  if (!providerJob) {
    return undefined;
  }

  return {
    provider: providerJob.provider,
    sceneId: providerJob.sceneId,
    jobId: providerJob.jobId,
    status: providerJob.status,
    remoteStatus: providerJob.remoteStatus,
    submittedAt: providerJob.submittedAt,
    lastPolledAt: providerJob.lastPolledAt,
    pollAttemptCount: providerJob.pollAttemptCount,
    timeoutAt: providerJob.timeoutAt,
    requestFingerprint: providerJob.requestFingerprint,
    resumeVersion: providerJob.resumeVersion,
  };
}

function classifyHydratedScene(scene: SceneRecord): SceneRecord {
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

  if (scene.lifecycle === "queued") {
    return {
      ...scene,
      lifecycle: "idle",
      progress: 0,
      provider: undefined,
      providerJob: undefined,
      error: undefined,
      selectedVariation: sanitizedSelectedVariation,
      queuedAt: undefined,
      startedAt: undefined,
      completedAt: undefined,
    };
  }

  if (!scene.providerJob) {
    return {
      ...scene,
      lifecycle: "idle",
      progress: 0,
      provider: undefined,
      providerJob: undefined,
      error: undefined,
      selectedVariation: sanitizedSelectedVariation,
      queuedAt: undefined,
      startedAt: undefined,
      completedAt: undefined,
    };
  }

  const providerJobClassification = classifyProviderJobForHydration(scene);
  if (providerJobClassification.kind === "resume_needed") {
    return {
      ...scene,
      provider: providerJobClassification.providerJob.provider,
      providerJob: providerJobClassification.providerJob,
      error: undefined,
      selectedVariation: sanitizedSelectedVariation,
    };
  }

  return {
    ...scene,
    lifecycle: "error",
    progress: 0,
    provider: providerJobClassification.provider,
    providerJob: providerJobClassification.providerJob,
    error: providerJobClassification.error,
    selectedVariation: sanitizedSelectedVariation,
    completedAt: scene.completedAt ?? new Date().toISOString(),
  };
}

function classifyProviderJobForHydration(
  scene: SceneRecord,
):
  | {
      kind: "resume_needed";
      providerJob: SceneProviderJobState;
    }
  | {
      kind: "error";
      provider?: SceneProvider;
      providerJob?: SceneProviderJobState;
      error: SceneGenerationError;
    } {
  const providerJob = scene.providerJob;
  if (!providerJob) {
    return {
      kind: "error",
      error: {
        message: "Persisted provider job metadata is missing.",
        code: "provider_job_resume_unavailable",
      },
    };
  }

  if (!isValidPersistedProviderJob(scene, providerJob)) {
    return {
      kind: "error",
      provider: scene.provider,
      providerJob: {
        ...providerJob,
        resumeState: "resume_unavailable",
        label: "Resume unavailable",
      },
      error: {
        message: "Persisted provider job metadata could not be resumed safely.",
        code: "provider_job_resume_unavailable",
      },
    };
  }

  if (Date.parse(providerJob.timeoutAt) <= Date.now()) {
    return {
      kind: "error",
      provider: providerJob.provider,
      providerJob: {
        ...providerJob,
        resumeState: "expired",
        label: "Provider job expired",
      },
      error: {
        message: "Provider job expired before resume could start.",
        code: "provider_job_expired",
      },
    };
  }

  return {
    kind: "resume_needed",
    providerJob: {
      ...providerJob,
      resumeState: "resume_needed",
      label: "Resumable job found",
    },
  };
}

function isResumeNeededProviderJob(
  providerJob?: SceneProviderJobState,
): providerJob is SceneProviderJobState {
  return (
    providerJob?.resumeState === "resume_needed" ||
    providerJob?.label === "Resumable job found"
  );
}

function toPersistedProviderJobSubmission(
  providerJob?: SceneProviderJobState,
): ProviderJobSubmission | undefined {
  if (!providerJob) {
    return undefined;
  }

  return {
    kind: "submitted",
    handle: {
      provider: providerJob.provider,
      jobId: providerJob.jobId,
      status: providerJob.status as ProviderJobActiveStatus,
      metadata: {
        provider: providerJob.provider,
        acceptedAt: providerJob.submittedAt,
        attemptCount: providerJob.pollAttemptCount,
        remoteStatus: providerJob.remoteStatus,
      },
    },
  };
}

function isValidPersistedProviderJob(
  scene: SceneRecord,
  providerJob: SceneProviderJobState,
): boolean {
  return (
    (providerJob.provider === "replicate" || providerJob.provider === "gemini") &&
    providerJob.sceneId === scene.id &&
    typeof providerJob.jobId === "string" &&
    providerJob.jobId.length > 0 &&
    typeof providerJob.status === "string" &&
    providerJob.status.length > 0 &&
    typeof providerJob.submittedAt === "string" &&
    Number.isFinite(Date.parse(providerJob.submittedAt)) &&
    typeof providerJob.timeoutAt === "string" &&
    Number.isFinite(Date.parse(providerJob.timeoutAt)) &&
    typeof providerJob.requestFingerprint === "string" &&
    providerJob.requestFingerprint ===
      createSceneRequestFingerprint(scene.payload, providerJob.provider) &&
    providerJob.resumeVersion === providerJobResumeVersion &&
    Number.isInteger(providerJob.pollAttemptCount) &&
    providerJob.pollAttemptCount >= 0
  );
}

function createProviderJobTimeoutAt(startedAt?: string): string {
  const startedAtMs = Number.isFinite(Date.parse(startedAt ?? ""))
    ? Date.parse(startedAt ?? "")
    : Date.now();

  return new Date(startedAtMs + defaultProviderJobTimeoutMs).toISOString();
}

function createSceneRequestFingerprint(
  payload: SceneRecord["payload"],
  provider: SceneProvider,
): string {
  return JSON.stringify({
    provider,
    prompt: payload.prompt,
    style: payload.style ?? "",
    duration: payload.duration ?? null,
  });
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
      details: normalizeAgentErrorDetails(error),
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

function normalizeAgentErrorDetails(
  error: SceneGenerationAgentError,
): unknown {
  if (
    error.code === "provider_fallback_failed" &&
    typeof error.details === "object" &&
    error.details !== null &&
    "cause" in error.details
  ) {
    const cause = (error.details as { cause?: unknown }).cause;
    if (typeof cause === "object" && cause !== null) {
      return cause;
    }
  }

  return error.details;
}
