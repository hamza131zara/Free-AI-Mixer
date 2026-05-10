import { expect, test } from "@playwright/test";
import { createJSONStorage } from "zustand/middleware";
import { exportAgent } from "../../src/agents/exportAgent";
import type { ExportAgentStartResult } from "../../src/agents/exportAgent";
import type { ExportRenderSettings } from "../../src/types/exportJob";

type ExportStoreModule = typeof import("../../src/store/exportStore");
type TimelineStoreModule = typeof import("../../src/store/timelineStore");
type SceneStoreModule = typeof import("../../src/store/sceneStore");

const exportPersistKey = "free-ai-mixer-exports";

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

const createSuccessScene = (id: string): Record<string, unknown> => ({
  id,
  lifecycle: "success",
  payload: {
    prompt: "Exportable scene",
    style: "cinematic",
    duration: 8,
  },
  progress: 100,
  createdAt: "2026-05-09T00:00:00.000Z",
  completedAt: "2026-05-09T00:00:01.000Z",
  result: {
    image: "https://example.com/image.png",
    variations: ["https://example.com/variation.png"],
  },
});

const renderSettings: ExportRenderSettings = {
  format: "mp4",
  resolution: "1080p",
  fps: 30,
  quality: "standard",
};

const seedTimelineWithClip = async (
  sceneId = "scene-success",
): Promise<{
  timelineId: string;
  exportStore: ExportStoreModule["useExportStore"];
  timelineStore: TimelineStoreModule["useTimelineStore"];
  sceneStore: SceneStoreModule["useSceneStore"];
}> => {
  const { useSceneStore } = (await import("../../src/store/sceneStore")) as SceneStoreModule;
  const { useTimelineStore } = (await import("../../src/store/timelineStore")) as TimelineStoreModule;
  const { useExportStore } = (await import("../../src/store/exportStore")) as ExportStoreModule;

  useSceneStore.setState({
    hasHydrated: true,
    hydrationError: undefined,
    draft: { prompt: "", style: "", duration: "" },
    scenes: [createSuccessScene(sceneId)] as never[],
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

  useTimelineStore.getState().createTimeline("Export Timeline");
  const timelineId = useTimelineStore.getState().activeTimelineId!;
  useTimelineStore.getState().addSceneClip(timelineId, sceneId, { durationMs: 1000 });

  useExportStore.setState({
    hasHydrated: true,
    hydrationError: undefined,
    jobsByTimelineId: {},
    activeExportTimelineId: undefined,
    isSubmittingByTimelineId: {},
    isResolvingByTimelineId: {},
  });

  return {
    timelineId,
    exportStore: useExportStore,
    timelineStore: useTimelineStore,
    sceneStore: useSceneStore,
  };
};

test.describe("Phase 5.4 export store integration", () => {
  test("rehydrates persisted resume_needed/resume_unavailable/expired jobs with selector visibility", async () => {
    const storage = setUpWindowForStores();
    const timelineIdResume = "timeline-resume-needed";
    const timelineIdUnavailable = "timeline-resume-unavailable";
    const timelineIdExpired = "timeline-expired";

    storage.setItem(
      exportPersistKey,
      JSON.stringify({
        state: {
          jobsByTimelineId: {
            [timelineIdResume]: {
              timelineId: timelineIdResume,
              requestId: "request-resume-needed",
              lifecycle: "submitted",
              handle: {
                provider: "backend_render",
                requestId: "request-resume-needed",
                jobId: "job-resume-needed",
                status: "submitted",
              },
              resumeState: "resume_needed",
            },
            [timelineIdUnavailable]: {
              timelineId: timelineIdUnavailable,
              requestId: "request-resume-unavailable",
              lifecycle: "error",
              resumeState: "resume_unavailable",
              failure: {
                message: "Export job resume metadata is unavailable.",
                code: "export_resume_unavailable",
              },
            },
            [timelineIdExpired]: {
              timelineId: timelineIdExpired,
              requestId: "request-expired",
              lifecycle: "expired",
              resumeState: "expired",
              failure: {
                message: "Export job has expired.",
                code: "export_job_expired",
              },
            },
          },
          activeExportTimelineId: timelineIdResume,
        },
        version: 1,
      }),
    );

    const exportStoreModule = (await import(
      "../../src/store/exportStore"
    )) as ExportStoreModule;
    const { useExportStore } = exportStoreModule;

    (useExportStore.persist as unknown as {
      setOptions: (options: { storage: unknown }) => void;
    }).setOptions({
      storage: createJSONStorage(() => storage as unknown as Storage),
    });

    await useExportStore.persist.rehydrate();

    const state = useExportStore.getState();
    expect(state.jobsByTimelineId[timelineIdResume]).toBeTruthy();
    expect(state.jobsByTimelineId[timelineIdResume]?.lifecycle).toBe("submitted");
    expect(state.jobsByTimelineId[timelineIdResume]?.resumeState).toBe(
      "resume_needed",
    );

    expect(state.jobsByTimelineId[timelineIdUnavailable]?.lifecycle).toBe("error");
    expect(state.jobsByTimelineId[timelineIdUnavailable]?.resumeState).toBe(
      "resume_unavailable",
    );

    expect(state.jobsByTimelineId[timelineIdExpired]?.lifecycle).toBe("expired");
    expect(state.jobsByTimelineId[timelineIdExpired]?.resumeState).toBe("expired");

    expect(
      exportStoreModule.selectExportStateByTimelineId(state, timelineIdResume),
    ).toBeTruthy();
    expect(
      exportStoreModule.selectExportLifecycleByTimelineId(state, timelineIdResume),
    ).toBe("submitted");
    expect(
      exportStoreModule.selectExportResumeState(state, timelineIdResume),
    ).toBe("resume_needed");

    expect(
      exportStoreModule.selectExportLifecycleByTimelineId(
        state,
        timelineIdUnavailable,
      ),
    ).toBe("error");
    expect(
      exportStoreModule.selectExportResumeState(state, timelineIdUnavailable),
    ).toBe("resume_unavailable");

    expect(
      exportStoreModule.selectExportLifecycleByTimelineId(state, timelineIdExpired),
    ).toBe("expired");
    expect(
      exportStoreModule.selectExportResumeState(state, timelineIdExpired),
    ).toBe("expired");
  });

  test("requestExport creates accepted job state and duplicate submit is blocked while in-flight", async () => {
    setUpWindowForStores();
    const { timelineId, exportStore } = await seedTimelineWithClip();
    let startCalls = 0;
    const originalStart = exportAgent.startExport;
    exportAgent.startExport = async () => {
      startCalls += 1;
      const accepted: ExportAgentStartResult = {
        kind: "accepted_job",
        handle: {
          provider: "backend_render",
          requestId: "request-1",
          jobId: "job-1",
          status: "submitted",
        },
      };
      return accepted;
    };

    try {
      const first = await exportStore.getState().requestExport(timelineId, renderSettings);
      expect(first?.lifecycle).toBe("submitted");
      expect(first?.handle?.jobId).toBe("job-1");
      expect(startCalls).toBe(1);

      const second = await exportStore.getState().requestExport(timelineId, renderSettings);
      expect(second?.lifecycle).toBe("submitted");
      expect(startCalls).toBe(1);
    } finally {
      exportAgent.startExport = originalStart;
    }
  });

  test("immediate success is applied directly with artifact refs only", async () => {
    setUpWindowForStores();
    const { timelineId, exportStore } = await seedTimelineWithClip();
    const originalStart = exportAgent.startExport;
    exportAgent.startExport = async () => ({
      kind: "success",
      result: {
        provider: "backend_render",
        requestId: "request-success",
        jobId: "job-success",
        artifacts: [{ id: "artifact-1" }],
      },
    });

    try {
      const result = await exportStore.getState().requestExport(timelineId, renderSettings);
      expect(result?.lifecycle).toBe("success");
      expect(result?.result?.artifacts).toEqual([{ id: "artifact-1" }]);
      expect(result?.result?.artifacts[0]?.url).toBeUndefined();
      expect("blob" in ((result?.result?.artifacts[0] ?? {}) as object)).toBeFalsy();
    } finally {
      exportAgent.startExport = originalStart;
    }
  });

  test("requestExport stores truthful failure result", async () => {
    setUpWindowForStores();
    const { timelineId, exportStore } = await seedTimelineWithClip();
    const originalStart = exportAgent.startExport;
    exportAgent.startExport = async () => ({
      kind: "failure",
      failure: {
        message: "export failed",
        code: "http_error",
      },
    });

    try {
      const result = await exportStore.getState().requestExport(timelineId, renderSettings);
      expect(result).toMatchObject({
        lifecycle: "error",
        failure: {
          code: "http_error",
        },
      });
    } finally {
      exportAgent.startExport = originalStart;
    }
  });

  test("selectExportCanSubmit is false in-flight and true on terminal states", async () => {
    setUpWindowForStores();
    const { timelineId, exportStore } = await seedTimelineWithClip();
    const selectors = (await import("../../src/store/exportStore")) as ExportStoreModule;

    exportStore.setState({
      jobsByTimelineId: {
        [timelineId]: {
          timelineId,
          requestId: "request-a",
          lifecycle: "rendering",
          resumeState: "none",
        },
      },
    });
    expect(selectors.selectExportCanSubmit(exportStore.getState(), timelineId)).toBeFalsy();

    exportStore.setState({
      jobsByTimelineId: {
        [timelineId]: {
          timelineId,
          requestId: "request-b",
          lifecycle: "success",
          result: {
            provider: "backend_render",
            requestId: "request-b",
            jobId: "job-b",
            artifacts: [{ id: "artifact-b" }],
          },
          resumeState: "none",
        },
      },
    });
    expect(selectors.selectExportCanSubmit(exportStore.getState(), timelineId)).toBeTruthy();
  });

  test("hydrated in-flight jobs classify to resume_needed, resume_unavailable, and expired", async () => {
    setUpWindowForStores();
    const { timelineId, exportStore } = await seedTimelineWithClip();
    const nowIso = "2026-05-09T12:00:00.000Z";

    exportStore.setState({
      jobsByTimelineId: {
        [timelineId]: {
          timelineId,
          requestId: "request-valid",
          lifecycle: "submitted",
          handle: {
            provider: "backend_render",
            requestId: "request-valid",
            jobId: "job-valid",
            status: "submitted",
          },
          timeoutAt: "2026-05-09T12:10:00.000Z",
          resumeState: "none",
        },
        bad: {
          timelineId: "bad",
          requestId: "request-bad",
          lifecycle: "rendering",
          timeoutAt: "2026-05-09T12:10:00.000Z",
          resumeState: "none",
        },
        expired: {
          timelineId: "expired",
          requestId: "request-expired",
          lifecycle: "finalizing",
          handle: {
            provider: "backend_render",
            requestId: "request-expired",
            jobId: "job-expired",
            status: "finalizing",
          },
          timeoutAt: "2026-05-09T11:00:00.000Z",
          resumeState: "none",
        },
      },
    });

    exportStore.getState().classifyHydratedExportJobs(nowIso);
    const state = exportStore.getState().jobsByTimelineId;
    expect(state[timelineId]?.resumeState).toBe("resume_needed");
    expect(state.bad?.resumeState).toBe("resume_unavailable");
    expect(state.expired?.resumeState).toBe("expired");
  });

  test("persisted shape excludes transient guards and in-memory lock fields", async () => {
    const storage = setUpWindowForStores();
    const { useExportStore } = (await import("../../src/store/exportStore")) as ExportStoreModule;
    (useExportStore.persist as unknown as {
      setOptions: (options: { storage: unknown }) => void;
    }).setOptions({
      storage: createJSONStorage(() => storage as unknown as Storage),
    });

    useExportStore.setState({
      hasHydrated: true,
      hydrationError: undefined,
      jobsByTimelineId: {
        timelineA: {
          timelineId: "timelineA",
          requestId: "requestA",
          lifecycle: "submitted",
          handle: {
            provider: "backend_render",
            requestId: "requestA",
            jobId: "jobA",
            status: "submitted",
          },
          resumeState: "none",
        },
      },
      activeExportTimelineId: "timelineA",
      isSubmittingByTimelineId: { timelineA: true },
      isResolvingByTimelineId: { timelineA: true },
    });

    const raw = storage.getItem(exportPersistKey);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw ?? "{}") as {
      state?: Record<string, unknown>;
    };
    const persistedState = parsed.state ?? {};

    expect(persistedState.jobsByTimelineId).toBeTruthy();
    expect(persistedState.activeExportTimelineId).toBe("timelineA");
    expect("isSubmittingByTimelineId" in persistedState).toBeFalsy();
    expect("isResolvingByTimelineId" in persistedState).toBeFalsy();
  });

  test("requestExport does not mutate timelineStore or sceneStore", async () => {
    setUpWindowForStores();
    const { timelineId, exportStore, timelineStore, sceneStore } =
      await seedTimelineWithClip();
    const timelineBefore = JSON.stringify(timelineStore.getState().timelines);
    const sceneBefore = JSON.stringify(sceneStore.getState().scenes);
    const originalStart = exportAgent.startExport;
    exportAgent.startExport = async () => ({
      kind: "accepted_job",
      handle: {
        provider: "backend_render",
        requestId: "request-inflight",
        jobId: "job-inflight",
        status: "rendering",
      },
    });

    try {
      await exportStore.getState().requestExport(timelineId, renderSettings);
      expect(JSON.stringify(timelineStore.getState().timelines)).toBe(timelineBefore);
      expect(JSON.stringify(sceneStore.getState().scenes)).toBe(sceneBefore);
    } finally {
      exportAgent.startExport = originalStart;
    }
  });
});
