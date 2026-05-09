import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useSceneStore } from "./sceneStore";
import type {
  SceneId,
  Timeline,
  TimelineClip,
  TimelineClipId,
  TimelineId,
  TimelineInsertMode,
  TimelinePlaybackState,
} from "../types/timeline";

const timelineStorePersistKey = "free-ai-mixer-timelines";
const defaultClipDurationMs = 3_000;
const emptyTimelineClips: TimelineClip[] = [];
const emptyTimelineSelection: Timeline["selection"] = {};
const emptyTimelinePlayback: TimelinePlaybackState = {
  status: "idle",
  currentTimeMs: 0,
  activeClipId: undefined,
};

export interface AddSceneClipOptions {
  insertMode?: TimelineInsertMode;
  referenceClipId?: TimelineClipId;
  durationMs?: number;
  label?: string;
}

export interface UpdateClipPatch {
  startMs?: number;
  durationMs?: number;
  label?: string;
}

export interface TimelineStoreState {
  hasHydrated: boolean;
  hydrationError?: string;
  timelines: Timeline[];
  activeTimelineId?: TimelineId;
  isMutating: boolean;
  setHydrationStatus: (hasHydrated: boolean, hydrationError?: string) => void;
  createTimeline: (name?: string) => void;
  setActiveTimeline: (timelineId: TimelineId) => void;
  renameTimeline: (timelineId: TimelineId, name: string) => void;
  removeTimeline: (timelineId: TimelineId) => void;
  addSceneClip: (
    timelineId: TimelineId,
    sceneId: SceneId,
    options?: AddSceneClipOptions,
  ) => void;
  updateClip: (
    timelineId: TimelineId,
    clipId: TimelineClipId,
    patch: UpdateClipPatch,
  ) => void;
  removeClip: (timelineId: TimelineId, clipId: TimelineClipId) => void;
  moveClipUp: (timelineId: TimelineId, clipId: TimelineClipId) => void;
  moveClipDown: (timelineId: TimelineId, clipId: TimelineClipId) => void;
  selectClip: (timelineId: TimelineId, clipId?: TimelineClipId) => void;
  setPlaybackState: (
    timelineId: TimelineId,
    patch: Partial<TimelinePlaybackState>,
  ) => void;
  resetPlayback: (timelineId: TimelineId) => void;
}

type PersistedTimelineStoreState = Pick<
  TimelineStoreState,
  "timelines" | "activeTimelineId"
>;

export const useTimelineStore = create<TimelineStoreState>()(
  persist(
    (set, get) => {
      const canMutateState = (): boolean => {
        const state = get();
        return state.hasHydrated && !state.hydrationError;
      };

      return {
        hasHydrated: false,
        hydrationError: undefined,
        timelines: [],
        activeTimelineId: undefined,
        isMutating: false,
        setHydrationStatus: (hasHydrated, hydrationError) => {
          set({ hasHydrated, hydrationError });
        },
        createTimeline: (name) => {
          if (!canMutateState()) {
            return;
          }

          set((state) => {
            const now = new Date().toISOString();
            const timeline: Timeline = {
              id: crypto.randomUUID(),
              name: normalizeTimelineName(
                name,
                state.timelines.length + 1,
              ),
              clips: [],
              selection: {},
              playback: defaultPlaybackState(),
              totalDurationMs: 0,
              createdAt: now,
              updatedAt: now,
            };

            return {
              timelines: [...state.timelines, timeline],
              activeTimelineId: timeline.id,
            };
          });
        },
        setActiveTimeline: (timelineId) => {
          if (!canMutateState()) {
            return;
          }

          set((state) => {
            const exists = state.timelines.some(
              (timeline) => timeline.id === timelineId,
            );
            if (!exists) {
              return state;
            }

            return { activeTimelineId: timelineId };
          });
        },
        renameTimeline: (timelineId, name) => {
          if (!canMutateState()) {
            return;
          }

          const normalizedName = name.trim();
          if (!normalizedName) {
            return;
          }

          set((state) => ({
            timelines: state.timelines.map((timeline) =>
              timeline.id === timelineId
                ? {
                    ...timeline,
                    name: normalizedName,
                    updatedAt: new Date().toISOString(),
                  }
                : timeline,
            ),
          }));
        },
        removeTimeline: (timelineId) => {
          if (!canMutateState()) {
            return;
          }

          set((state) => {
            const timelines = state.timelines.filter(
              (timeline) => timeline.id !== timelineId,
            );
            const activeTimelineId =
              state.activeTimelineId === timelineId
                ? timelines[0]?.id
                : state.activeTimelineId;

            return { timelines, activeTimelineId };
          });
        },
        addSceneClip: (timelineId, sceneId, options) => {
          if (!canMutateState() || !sceneId) {
            return;
          }

          const scene = useSceneStore
            .getState()
            .scenes.find((candidate) => candidate.id === sceneId);
          if (!scene || scene.lifecycle !== "success") {
            return;
          }

          const durationMs = options?.durationMs ?? defaultClipDurationMs;
          if (!Number.isFinite(durationMs) || durationMs <= 0) {
            return;
          }

          set((state) => ({
            timelines: state.timelines.map((timeline) => {
              if (timeline.id !== timelineId) {
                return timeline;
              }

              const mode = options?.insertMode ?? "append";
              const referenceClipId = options?.referenceClipId;
              const insertionIndex = findInsertionIndex(
                timeline.clips,
                mode,
                referenceClipId,
              );
              if (insertionIndex < 0) {
                return timeline;
              }

              const newClip: TimelineClip = {
                id: crypto.randomUUID(),
                sceneId,
                source: "scene",
                order: 0,
                startMs: 0,
                durationMs,
                label: options?.label,
              };

              const nextClips = insertClip(
                timeline.clips,
                newClip,
                mode,
                insertionIndex,
              );
              const normalized = normalizeClipLayout(nextClips);

              return {
                ...timeline,
                clips: normalized.clips,
                totalDurationMs: normalized.totalDurationMs,
                selection: {
                  clipId: newClip.id,
                  sceneId: newClip.sceneId,
                },
                updatedAt: new Date().toISOString(),
              };
            }),
          }));
        },
        updateClip: (timelineId, clipId, patch) => {
          if (!canMutateState()) {
            return;
          }

          if (
            patch.durationMs !== undefined &&
            (!Number.isFinite(patch.durationMs) || patch.durationMs <= 0)
          ) {
            return;
          }

          set((state) => ({
            timelines: state.timelines.map((timeline) => {
              if (timeline.id !== timelineId) {
                return timeline;
              }

              let found = false;
              const nextClips = timeline.clips.map((clip) => {
                if (clip.id !== clipId) {
                  return clip;
                }

                found = true;
                return {
                  ...clip,
                  durationMs: patch.durationMs ?? clip.durationMs,
                  label: patch.label ?? clip.label,
                };
              });

              if (!found) {
                return timeline;
              }

              const normalized = normalizeClipLayout(nextClips);
              return {
                ...timeline,
                clips: normalized.clips,
                totalDurationMs: normalized.totalDurationMs,
                updatedAt: new Date().toISOString(),
              };
            }),
          }));
        },
        removeClip: (timelineId, clipId) => {
          if (!canMutateState()) {
            return;
          }

          set((state) => ({
            timelines: state.timelines.map((timeline) => {
              if (timeline.id !== timelineId) {
                return timeline;
              }

              const nextClips = timeline.clips.filter((clip) => clip.id !== clipId);
              if (nextClips.length === timeline.clips.length) {
                return timeline;
              }

              const normalized = normalizeClipLayout(nextClips);
              const selectedClip = normalized.clips.find(
                (clip) => clip.id === timeline.selection.clipId,
              );

              return {
                ...timeline,
                clips: normalized.clips,
                totalDurationMs: normalized.totalDurationMs,
                selection: selectedClip
                  ? timeline.selection
                  : {},
                playback:
                  timeline.playback.activeClipId === clipId
                    ? {
                        ...timeline.playback,
                        activeClipId: undefined,
                      }
                    : timeline.playback,
                updatedAt: new Date().toISOString(),
              };
            }),
          }));
        },
        moveClipUp: (timelineId, clipId) => {
          if (!canMutateState()) {
            return;
          }

          set((state) => ({
            timelines: state.timelines.map((timeline) => {
              if (timeline.id !== timelineId || timeline.clips.length < 2) {
                return timeline;
              }

              const clipIndex = timeline.clips.findIndex((clip) => clip.id === clipId);
              if (clipIndex <= 0) {
                return timeline;
              }

              const nextClips = [...timeline.clips];
              const previousClip = nextClips[clipIndex - 1];
              const currentClip = nextClips[clipIndex];
              if (!previousClip || !currentClip) {
                return timeline;
              }

              nextClips[clipIndex - 1] = currentClip;
              nextClips[clipIndex] = previousClip;

              const normalized = normalizeClipLayout(nextClips);
              return {
                ...timeline,
                clips: normalized.clips,
                totalDurationMs: normalized.totalDurationMs,
                updatedAt: new Date().toISOString(),
              };
            }),
          }));
        },
        moveClipDown: (timelineId, clipId) => {
          if (!canMutateState()) {
            return;
          }

          set((state) => ({
            timelines: state.timelines.map((timeline) => {
              if (timeline.id !== timelineId || timeline.clips.length < 2) {
                return timeline;
              }

              const clipIndex = timeline.clips.findIndex((clip) => clip.id === clipId);
              if (clipIndex < 0 || clipIndex >= timeline.clips.length - 1) {
                return timeline;
              }

              const nextClips = [...timeline.clips];
              const currentClip = nextClips[clipIndex];
              const nextClip = nextClips[clipIndex + 1];
              if (!currentClip || !nextClip) {
                return timeline;
              }

              nextClips[clipIndex] = nextClip;
              nextClips[clipIndex + 1] = currentClip;

              const normalized = normalizeClipLayout(nextClips);
              return {
                ...timeline,
                clips: normalized.clips,
                totalDurationMs: normalized.totalDurationMs,
                updatedAt: new Date().toISOString(),
              };
            }),
          }));
        },
        selectClip: (timelineId, clipId) => {
          if (!canMutateState()) {
            return;
          }

          set((state) => ({
            timelines: state.timelines.map((timeline) => {
              if (timeline.id !== timelineId) {
                return timeline;
              }

              if (!clipId) {
                return {
                  ...timeline,
                  selection: {},
                  updatedAt: new Date().toISOString(),
                };
              }

              const clip = timeline.clips.find((candidate) => candidate.id === clipId);
              if (!clip) {
                return timeline;
              }

              return {
                ...timeline,
                selection: {
                  clipId: clip.id,
                  sceneId: clip.sceneId,
                },
                updatedAt: new Date().toISOString(),
              };
            }),
          }));
        },
        setPlaybackState: (timelineId, patch) => {
          if (!canMutateState()) {
            return;
          }

          set((state) => ({
            timelines: state.timelines.map((timeline) =>
              timeline.id === timelineId
                ? {
                    ...timeline,
                    playback: {
                      ...timeline.playback,
                      ...patch,
                    },
                    updatedAt: new Date().toISOString(),
                  }
                : timeline,
            ),
          }));
        },
        resetPlayback: (timelineId) => {
          if (!canMutateState()) {
            return;
          }

          set((state) => ({
            timelines: state.timelines.map((timeline) =>
              timeline.id === timelineId
                ? {
                    ...timeline,
                    playback: defaultPlaybackState(),
                    updatedAt: new Date().toISOString(),
                  }
                : timeline,
            ),
          }));
        },
      };
    },
    {
      name: timelineStorePersistKey,
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedTimelineStoreState => ({
        timelines: state.timelines,
        activeTimelineId: state.activeTimelineId,
      }),
      merge: (persistedState, currentState): TimelineStoreState => {
        const persisted = persistedState as Partial<PersistedTimelineStoreState>;
        return {
          ...currentState,
          timelines: persisted.timelines ?? currentState.timelines,
          activeTimelineId:
            persisted.activeTimelineId ?? currentState.activeTimelineId,
          hasHydrated: false,
          hydrationError: undefined,
          isMutating: false,
        };
      },
    },
  ),
);

export const selectActiveTimeline = (state: TimelineStoreState): Timeline | undefined =>
  state.timelines.find((timeline) => timeline.id === state.activeTimelineId);

export const selectActiveTimelineClips = (
  state: TimelineStoreState,
): TimelineClip[] => {
  const timeline = selectActiveTimeline(state);
  if (!timeline) {
    return emptyTimelineClips;
  }

  return [...timeline.clips].sort((left, right) => left.order - right.order);
};

export const selectActiveTimelineSelection = (
  state: TimelineStoreState,
): Timeline["selection"] =>
  selectActiveTimeline(state)?.selection ?? emptyTimelineSelection;

export const selectActiveTimelinePlayback = (
  state: TimelineStoreState,
): TimelinePlaybackState =>
  selectActiveTimeline(state)?.playback ?? emptyTimelinePlayback;

export const selectTimelineTotalDurationMs = (
  state: TimelineStoreState,
): number => selectActiveTimeline(state)?.totalDurationMs ?? 0;

export const selectCanAddSceneToTimeline = (
  _state: TimelineStoreState,
  sceneId: SceneId,
): boolean => {
  if (!sceneId) {
    return false;
  }

  const scene = useSceneStore
    .getState()
    .scenes.find((candidate) => candidate.id === sceneId);

  return scene?.lifecycle === "success";
};

useTimelineStore.persist.onFinishHydration(() => {
  useTimelineStore.setState({
    hasHydrated: true,
    hydrationError: undefined,
  });
});

if (useTimelineStore.persist.hasHydrated()) {
  useTimelineStore.setState({
    hasHydrated: true,
    hydrationError: undefined,
  });
} else if (
  typeof window !== "undefined" &&
  window.localStorage.getItem(timelineStorePersistKey) === null
) {
  useTimelineStore.setState({
    hasHydrated: true,
    hydrationError: undefined,
  });
} else {
  const rehydrateResult = useTimelineStore.persist.rehydrate();
  if (rehydrateResult instanceof Promise) {
    void rehydrateResult.catch((error: unknown) => {
      useTimelineStore.setState({
        hasHydrated: false,
        hydrationError: error instanceof Error ? error.message : undefined,
      });
    });
  }
}

function normalizeTimelineName(name: string | undefined, index: number): string {
  const normalized = name?.trim();
  if (normalized) {
    return normalized;
  }

  return `Timeline ${index}`;
}

function defaultPlaybackState(): TimelinePlaybackState {
  return {
    status: "idle",
    currentTimeMs: 0,
    activeClipId: undefined,
  };
}

function findInsertionIndex(
  clips: TimelineClip[],
  mode: TimelineInsertMode,
  referenceClipId?: TimelineClipId,
): number {
  if (mode === "append") {
    return clips.length;
  }

  if (!referenceClipId) {
    return -1;
  }

  const referenceIndex = clips.findIndex((clip) => clip.id === referenceClipId);
  if (referenceIndex < 0) {
    return -1;
  }

  if (mode === "before" || mode === "replace") {
    return referenceIndex;
  }

  return referenceIndex + 1;
}

function insertClip(
  clips: TimelineClip[],
  clip: TimelineClip,
  mode: TimelineInsertMode,
  insertionIndex: number,
): TimelineClip[] {
  if (mode === "replace") {
    return [
      ...clips.slice(0, insertionIndex),
      clip,
      ...clips.slice(insertionIndex + 1),
    ];
  }

  return [
    ...clips.slice(0, insertionIndex),
    clip,
    ...clips.slice(insertionIndex),
  ];
}

function normalizeClipLayout(clips: TimelineClip[]): {
  clips: TimelineClip[];
  totalDurationMs: number;
} {
  let nextStartMs = 0;
  const normalized = clips.map((clip, index) => {
    const normalizedClip: TimelineClip = {
      ...clip,
      order: index,
      startMs: nextStartMs,
    };
    nextStartMs += normalizedClip.durationMs;
    return normalizedClip;
  });

  return {
    clips: normalized,
    totalDurationMs: nextStartMs,
  };
}
