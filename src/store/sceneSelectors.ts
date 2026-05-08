import type { SceneLifecycle, SceneRecord } from "../types/scene";
import type { SceneStoreState } from "./sceneStore";

export interface SceneQueueSummary {
  total: number;
  activeJobs: number;
  queuedJobs: number;
  idle: number;
  queued: number;
  generating: number;
  success: number;
  error: number;
}

export interface SceneViewModel {
  id: string;
  prompt: string;
  style: string;
  duration: string;
  lifecycle: SceneLifecycle;
  progressLabel: string;
  provider: string;
  image?: string;
  variations: string[];
  selectedVariation?: string;
  error?: string;
  canGenerate: boolean;
  canRetry: boolean;
  canRemove: boolean;
  canSelectVariation: boolean;
}

export const selectDraft = (state: SceneStoreState) => state.draft;

export const selectHasHydrated = (state: SceneStoreState) => state.hasHydrated;

export const selectHydrationError = (state: SceneStoreState) =>
  state.hydrationError;

export const selectComposerError = (state: SceneStoreState) =>
  state.composerError;

export const selectCanAddScene = (state: SceneStoreState): boolean =>
  state.hasHydrated &&
  !state.hydrationError &&
  state.draft.prompt.trim().length > 0 &&
  !state.isGeneratingAll;

export const selectCanGenerateAll = (state: SceneStoreState): boolean =>
  state.hasHydrated &&
  !state.hydrationError &&
  !state.isGeneratingAll &&
  state.scenes.some(
    (scene) => scene.lifecycle === "idle" || scene.lifecycle === "error",
  );

export const selectCanClearTerminalScenes = (
  state: SceneStoreState,
): boolean =>
  state.hasHydrated &&
  !state.hydrationError &&
  !state.isGeneratingAll &&
  state.scenes.some(
    (scene) => scene.lifecycle === "success" || scene.lifecycle === "error",
  );

let cachedSummaryScenes: SceneRecord[] | undefined;
let cachedQueueSummary: SceneQueueSummary = {
  total: 0,
  activeJobs: 0,
  queuedJobs: 0,
  idle: 0,
  queued: 0,
  generating: 0,
  success: 0,
  error: 0,
};

export const selectQueueSummary = (
  state: SceneStoreState,
): SceneQueueSummary => {
  if (state.scenes === cachedSummaryScenes) {
    return cachedQueueSummary;
  }

  cachedSummaryScenes = state.scenes;
  cachedQueueSummary = state.scenes.reduce<SceneQueueSummary>(
    (summary, scene) => ({
      ...summary,
      [scene.lifecycle]: summary[scene.lifecycle] + 1,
      activeJobs:
        scene.lifecycle === "generating"
          ? summary.activeJobs + 1
          : summary.activeJobs,
      queuedJobs:
        scene.lifecycle === "queued" ? summary.queuedJobs + 1 : summary.queuedJobs,
    }),
    {
      total: state.scenes.length,
      activeJobs: 0,
      queuedJobs: 0,
      idle: 0,
      queued: 0,
      generating: 0,
      success: 0,
      error: 0,
    },
  );

  return cachedQueueSummary;
};

let cachedViewModelScenes: SceneRecord[] | undefined;
let cachedViewModelHasHydrated = false;
let cachedViewModelHydrationError: string | undefined;
let cachedViewModelIsGeneratingAll = false;
let cachedSceneViewModels: SceneViewModel[] = [];
const cachedSceneViewModelItems = new WeakMap<SceneRecord, SceneViewModel>();

export const selectSceneViewModels = (
  state: SceneStoreState,
): SceneViewModel[] => {
  if (
    state.scenes === cachedViewModelScenes &&
    state.hasHydrated === cachedViewModelHasHydrated &&
    state.hydrationError === cachedViewModelHydrationError &&
    state.isGeneratingAll === cachedViewModelIsGeneratingAll
  ) {
    return cachedSceneViewModels;
  }

  cachedViewModelScenes = state.scenes;
  cachedViewModelHasHydrated = state.hasHydrated;
  cachedViewModelHydrationError = state.hydrationError;
  cachedViewModelIsGeneratingAll = state.isGeneratingAll;

  cachedSceneViewModels = state.scenes.map((scene) => {
    const isInteractive =
      state.hasHydrated && !state.hydrationError && !state.isGeneratingAll;
    const nextViewModel: SceneViewModel = {
      id: scene.id,
      prompt: scene.payload.prompt,
      style: scene.payload.style ?? "Unstyled",
      duration:
        typeof scene.payload.duration === "number"
          ? `${scene.payload.duration}s`
          : "Default",
      lifecycle: scene.lifecycle,
      progressLabel: `${scene.progress}%`,
      provider: scene.provider ?? "Unassigned",
      image: scene.selectedVariation ?? scene.result?.image,
      variations: scene.result?.variations ?? [],
      selectedVariation: scene.selectedVariation,
      error: scene.error?.message,
      canGenerate:
        isInteractive &&
        (scene.lifecycle === "idle" || scene.lifecycle === "success"),
      canRetry: isInteractive && scene.lifecycle === "error",
      canRemove:
        isInteractive &&
        scene.lifecycle !== "queued" &&
        scene.lifecycle !== "generating",
      canSelectVariation:
        state.hasHydrated &&
        !state.hydrationError &&
        (scene.result?.variations.length ?? 0) > 0,
    };
    const cachedViewModel = cachedSceneViewModelItems.get(scene);

    if (
      cachedViewModel &&
      cachedViewModel.prompt === nextViewModel.prompt &&
      cachedViewModel.style === nextViewModel.style &&
      cachedViewModel.duration === nextViewModel.duration &&
      cachedViewModel.lifecycle === nextViewModel.lifecycle &&
      cachedViewModel.progressLabel === nextViewModel.progressLabel &&
      cachedViewModel.provider === nextViewModel.provider &&
      cachedViewModel.image === nextViewModel.image &&
      cachedViewModel.variations === nextViewModel.variations &&
      cachedViewModel.selectedVariation === nextViewModel.selectedVariation &&
      cachedViewModel.error === nextViewModel.error &&
      cachedViewModel.canGenerate === nextViewModel.canGenerate &&
      cachedViewModel.canRetry === nextViewModel.canRetry &&
      cachedViewModel.canRemove === nextViewModel.canRemove &&
      cachedViewModel.canSelectVariation === nextViewModel.canSelectVariation
    ) {
      return cachedViewModel;
    }

    cachedSceneViewModelItems.set(scene, nextViewModel);
    return nextViewModel;
  });

  return cachedSceneViewModels;
};
