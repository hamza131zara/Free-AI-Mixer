import { expect, test } from "@playwright/test";
import { createJSONStorage } from "zustand/middleware";

const timelinePersistKey = "free-ai-mixer-timelines";

type TimelineStoreModule = typeof import("../../src/store/timelineStore");
type SceneStoreModule = typeof import("../../src/store/sceneStore");

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

const setUpWindowForStores = (): MemoryStorage => {
  const storage = new MemoryStorage();
  const win = {
    localStorage: storage,
    setTimeout,
    clearTimeout,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };

  Object.assign(globalThis, {
    window: win,
    localStorage: storage,
  });

  return storage;
};

const createSuccessScene = (id: string, prompt = "Timeline ready"): Record<string, unknown> => ({
  id,
  lifecycle: "success",
  payload: {
    prompt,
    style: "cinematic",
    duration: 8,
  },
  progress: 100,
  createdAt: "2026-05-08T00:00:00.000Z",
  completedAt: "2026-05-08T00:00:03.000Z",
  result: {
    image: "https://example.com/image.png",
    variations: ["https://example.com/variation.png"],
  },
});

const createIdleScene = (id: string): Record<string, unknown> => ({
  id,
  lifecycle: "idle",
  payload: {
    prompt: "Not ready",
    style: "cinematic",
    duration: 8,
  },
  progress: 0,
  createdAt: "2026-05-08T00:00:00.000Z",
});

test.describe("Phase 4.2 timeline store", () => {
  test("createTimeline creates a timeline and sets it active", async () => {
    setUpWindowForStores();
    const { useTimelineStore } = (await import("../../src/store/timelineStore")) as TimelineStoreModule;

    useTimelineStore.setState({
      hasHydrated: true,
      hydrationError: undefined,
      timelines: [],
      activeTimelineId: undefined,
      isMutating: false,
    });

    useTimelineStore.getState().createTimeline("Edit A");
    const state = useTimelineStore.getState();
    expect(state.timelines).toHaveLength(1);
    expect(state.timelines[0]?.name).toBe("Edit A");
    expect(state.activeTimelineId).toBe(state.timelines[0]?.id);
  });

  test("addSceneClip adds only sceneId clip fields and rejects invalid inputs safely", async () => {
    setUpWindowForStores();
    const { useSceneStore } = (await import("../../src/store/sceneStore")) as SceneStoreModule;
    const { useTimelineStore } = (await import("../../src/store/timelineStore")) as TimelineStoreModule;

    useSceneStore.setState({
      hasHydrated: true,
      hydrationError: undefined,
      draft: { prompt: "", style: "", duration: "" },
      scenes: [createSuccessScene("success-scene"), createIdleScene("idle-scene")] as never[],
      isGeneratingAll: false,
      composerError: undefined,
    });

    useTimelineStore.setState({
      hasHydrated: true,
      hydrationError: undefined,
      timelines: [],
      activeTimelineId: undefined,
      isMutating: false,
    });

    useTimelineStore.getState().createTimeline("T1");
    const timelineId = useTimelineStore.getState().activeTimelineId!;
    const beforeScenes = JSON.stringify(useSceneStore.getState().scenes);

    useTimelineStore.getState().addSceneClip(timelineId, "success-scene", { durationMs: 1200 });
    let clips = useTimelineStore.getState().timelines[0]?.clips ?? [];
    expect(clips).toHaveLength(1);
    expect(clips[0]?.sceneId).toBe("success-scene");
    expect(clips[0]?.order).toBe(0);
    expect(clips[0]?.startMs).toBe(0);
    expect(clips[0]?.durationMs).toBe(1200);
    expect("image" in (clips[0] as object)).toBeFalsy();
    expect("prompt" in (clips[0] as object)).toBeFalsy();
    expect("provider" in (clips[0] as object)).toBeFalsy();

    useTimelineStore.getState().addSceneClip(timelineId, "");
    useTimelineStore.getState().addSceneClip(timelineId, "idle-scene");
    clips = useTimelineStore.getState().timelines[0]?.clips ?? [];
    expect(clips).toHaveLength(1);

    const afterScenes = JSON.stringify(useSceneStore.getState().scenes);
    expect(afterScenes).toBe(beforeScenes);
  });

  test("before/after/replace/remove recompute deterministic order and startMs", async () => {
    setUpWindowForStores();
    const { useSceneStore } = (await import("../../src/store/sceneStore")) as SceneStoreModule;
    const { useTimelineStore } = (await import("../../src/store/timelineStore")) as TimelineStoreModule;

    useSceneStore.setState({
      hasHydrated: true,
      hydrationError: undefined,
      draft: { prompt: "", style: "", duration: "" },
      scenes: [
        createSuccessScene("scene-a"),
        createSuccessScene("scene-b"),
        createSuccessScene("scene-c"),
        createSuccessScene("scene-d"),
      ] as never[],
      isGeneratingAll: false,
      composerError: undefined,
    });

    useTimelineStore.setState({
      hasHydrated: true,
      hydrationError: undefined,
      timelines: [],
      activeTimelineId: undefined,
      isMutating: false,
    });

    useTimelineStore.getState().createTimeline("T2");
    const timelineId = useTimelineStore.getState().activeTimelineId!;

    useTimelineStore.getState().addSceneClip(timelineId, "scene-a", { durationMs: 1000 });
    useTimelineStore.getState().addSceneClip(timelineId, "scene-b", { durationMs: 2000 });
    const firstClipId = useTimelineStore.getState().timelines[0]!.clips[0]!.id;
    const secondClipId = useTimelineStore.getState().timelines[0]!.clips[1]!.id;

    useTimelineStore.getState().addSceneClip(timelineId, "scene-c", {
      insertMode: "before",
      referenceClipId: secondClipId,
      durationMs: 500,
    });

    useTimelineStore.getState().addSceneClip(timelineId, "scene-d", {
      insertMode: "after",
      referenceClipId: firstClipId,
      durationMs: 700,
    });

    const ordered = useTimelineStore.getState().timelines[0]!.clips;
    expect(ordered.map((clip) => clip.order)).toEqual([0, 1, 2, 3]);
    expect(ordered.map((clip) => clip.startMs)).toEqual([0, 1000, 1700, 2200]);
    expect(ordered.map((clip) => clip.sceneId)).toEqual([
      "scene-a",
      "scene-d",
      "scene-c",
      "scene-b",
    ]);

    useTimelineStore.getState().addSceneClip(timelineId, "scene-b", {
      insertMode: "replace",
      referenceClipId: ordered[0]!.id,
      durationMs: 900,
    });
    const replaced = useTimelineStore.getState().timelines[0]!.clips;
    expect(replaced).toHaveLength(4);
    expect(replaced[0]!.sceneId).toBe("scene-b");
    expect("result" in (replaced[0] as object)).toBeFalsy();

    useTimelineStore.getState().selectClip(timelineId, replaced[1]!.id);
    useTimelineStore.getState().removeClip(timelineId, replaced[1]!.id);
    const afterRemoval = useTimelineStore.getState().timelines[0]!;
    expect(afterRemoval.clips.map((clip) => clip.order)).toEqual([0, 1, 2]);
    expect(afterRemoval.clips.map((clip) => clip.startMs)).toEqual([0, 900, 1400]);
    expect(afterRemoval.selection.clipId).toBeUndefined();
  });

  test("persisted timelines and activeTimelineId restore on hydration", async () => {
    const storage = setUpWindowForStores();
    const persisted = {
      state: {
        timelines: [
          {
            id: "timeline-1",
            name: "Restored",
            clips: [
              {
                id: "clip-1",
                sceneId: "scene-a",
                source: "scene",
                order: 0,
                startMs: 0,
                durationMs: 1000,
              },
            ],
            selection: { clipId: "clip-1", sceneId: "scene-a" },
            playback: { status: "idle", currentTimeMs: 0 },
            totalDurationMs: 1000,
            createdAt: "2026-05-08T00:00:00.000Z",
            updatedAt: "2026-05-08T00:00:00.000Z",
          },
        ],
        activeTimelineId: "timeline-1",
      },
      version: 1,
    };
    const { useTimelineStore } = (await import("../../src/store/timelineStore")) as TimelineStoreModule;
    (useTimelineStore.persist as unknown as {
      setOptions: (options: { storage: unknown }) => void;
    }).setOptions({
      storage: createJSONStorage(
        () => storage as unknown as Storage,
      ),
    });
    useTimelineStore.setState({
      hasHydrated: false,
      hydrationError: undefined,
      timelines: [],
      activeTimelineId: undefined,
      isMutating: false,
    });
    storage.setItem(timelinePersistKey, JSON.stringify(persisted));
    await useTimelineStore.persist.rehydrate();

    const state = useTimelineStore.getState();
    expect(state.activeTimelineId).toBe("timeline-1");
    expect(state.timelines).toHaveLength(1);
    expect(state.timelines[0]?.name).toBe("Restored");
    expect(state.timelines[0]?.clips[0]?.sceneId).toBe("scene-a");
  });

  test("timeline selectors return deterministic active timeline data", async () => {
    setUpWindowForStores();
    const { useSceneStore } = (await import("../../src/store/sceneStore")) as SceneStoreModule;
    const timelineModule = (await import("../../src/store/timelineStore")) as TimelineStoreModule;
    const {
      useTimelineStore,
      selectActiveTimeline,
      selectActiveTimelineClips,
      selectActiveTimelineSelection,
      selectActiveTimelinePlayback,
      selectTimelineTotalDurationMs,
      selectCanAddSceneToTimeline,
    } = timelineModule;

    useSceneStore.setState({
      hasHydrated: true,
      hydrationError: undefined,
      draft: { prompt: "", style: "", duration: "" },
      scenes: [createSuccessScene("scene-success"), createIdleScene("scene-idle")] as never[],
      isGeneratingAll: false,
      composerError: undefined,
    });

    useTimelineStore.setState({
      hasHydrated: true,
      hydrationError: undefined,
      timelines: [],
      activeTimelineId: undefined,
      isMutating: false,
    });

    useTimelineStore.getState().createTimeline("Selectors");
    const timelineId = useTimelineStore.getState().activeTimelineId!;
    useTimelineStore.getState().addSceneClip(timelineId, "scene-success", { durationMs: 1000 });
    const firstClipId = useTimelineStore.getState().timelines[0]!.clips[0]!.id;
    useTimelineStore.getState().addSceneClip(timelineId, "scene-success", {
      insertMode: "after",
      referenceClipId: firstClipId,
      durationMs: 2000,
    });
    useTimelineStore.getState().selectClip(
      timelineId,
      useTimelineStore.getState().timelines[0]!.clips[1]!.id,
    );
    useTimelineStore.getState().setPlaybackState(timelineId, {
      status: "paused",
      currentTimeMs: 500,
    });

    const state = useTimelineStore.getState();
    const activeTimeline = selectActiveTimeline(state);
    const clips = selectActiveTimelineClips(state);
    const selection = selectActiveTimelineSelection(state);
    const playback = selectActiveTimelinePlayback(state);
    const totalDurationMs = selectTimelineTotalDurationMs(state);

    expect(activeTimeline?.id).toBe(timelineId);
    expect(clips.map((clip) => clip.order)).toEqual([0, 1]);
    expect(clips.map((clip) => clip.startMs)).toEqual([0, 1000]);
    expect(totalDurationMs).toBe(3000);
    expect(selection.clipId).toBe(clips[1]!.id);
    expect(playback.status).toBe("paused");
    expect(playback.currentTimeMs).toBe(500);

    expect(selectCanAddSceneToTimeline(state, "scene-success")).toBeTruthy();
    expect(selectCanAddSceneToTimeline(state, "scene-idle")).toBeFalsy();
    expect(selectCanAddSceneToTimeline(state, "missing-scene")).toBeFalsy();
    expect(selectCanAddSceneToTimeline(state, "")).toBeFalsy();
  });
});
