import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { saveExportHandle } from "../../src/services/exportHandleStorage";

type ExportStoreModule = typeof import("../../src/store/exportStore");

const exportPersistKey = "free-ai-mixer-exports";
const exportStorePath = path.join(process.cwd(), "src", "store", "exportStore.ts");
const exportServicePath = path.join(
  process.cwd(),
  "src",
  "services",
  "exportService.ts",
);
const exportHandleStoragePath = path.join(
  process.cwd(),
  "src",
  "services",
  "exportHandleStorage.ts",
);
const timelineExportPanelPath = path.join(
  process.cwd(),
  "src",
  "components",
  "TimelineExportPanel.tsx",
);

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
    __FREE_AI_MIXER_RUNTIME_CONFIG__: {
      exportBaseUrl: "https://example.com",
      exportArtifactsPath: "/exports",
      exportPollPath: "/exports",
      exportSubmitPath: "/exports",
    },
  };

  Object.assign(globalThis, {
    window: win,
    localStorage: storage,
  });

  return storage;
};

const withMockedFetch = async (
  callback: () => Promise<void>,
  implementation: (...args: Parameters<typeof fetch>) => Response | Promise<Response>,
): Promise<void> => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (...args) => implementation(...args)) as typeof fetch;

  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

const getExportStore = async (): Promise<ExportStoreModule["useExportStore"]> => {
  const storeModule = (await import("../../src/store/exportStore")) as ExportStoreModule;
  return storeModule.useExportStore;
};

const resetExportStore = async (): Promise<void> => {
  const store = await getExportStore();
  store.setState({
    hasHydrated: true,
    hydrationError: undefined,
    jobsByTimelineId: {},
    activeExportTimelineId: undefined,
    isSubmittingByTimelineId: {},
    isResolvingByTimelineId: {},
  });
};

const createPendingState = (timelineId: string) => ({
  timelineId,
  requestId: "request-phase77",
  lifecycle: "submitted" as const,
  handle: {
    provider: "backend_render" as const,
    requestId: "request-phase77",
    jobId: "job-phase77",
    status: "submitted" as const,
  },
  submittedAt: "2026-05-20T12:00:00.000Z",
  resumeState: "none" as const,
});

test.describe("phase77 frontend db-backed export lifecycle pack", () => {
  test.beforeEach(async () => {
    setUpWindowForStores();
    await resetExportStore();
  });

  test("refreshExportStatus uses backend GET /exports/:jobId and maps pending and terminal success truthfully", async () => {
    const store = await getExportStore();
    const timelineId = "timeline-phase77-pending-success";
    store.setState({
      jobsByTimelineId: {
        [timelineId]: createPendingState(timelineId),
      },
    });

    const requestedUrls: string[] = [];

    await withMockedFetch(async () => {
      const pending = await store.getState().refreshExportStatus(timelineId);

      expect(requestedUrls[0]).toBe("https://example.com/exports/job-phase77");
      expect(pending?.lifecycle).toBe("rendering");
      expect(pending?.handle?.jobId).toBe("job-phase77");
      expect(pending?.handle?.status).toBe("rendering");
      expect(pending?.progress?.stage).toBe("rendering");
      expect(pending?.progress?.percent).toBeUndefined();

      const success = await store.getState().refreshExportStatus(timelineId);

      expect(requestedUrls[1]).toBe("https://example.com/exports/job-phase77");
      expect(success?.lifecycle).toBe("success");
      expect(success?.result?.jobId).toBe("job-phase77");
      expect(success?.result?.artifacts).toEqual([
        {
          id: "artifact-phase77",
          bytes: 2048,
          metadata: { durationMs: 1500 },
          status: "ready",
        },
      ]);
      expect(success?.result?.artifacts[0]?.url).toBeUndefined();
      expect("downloadUrl" in (success?.result?.artifacts[0] ?? {})).toBeFalsy();
      expect("signedUrl" in (success?.result?.artifacts[0] ?? {})).toBeFalsy();
      expect("storageRef" in (success?.result?.artifacts[0] ?? {})).toBeFalsy();
      expect("filePath" in (success?.result?.artifacts[0] ?? {})).toBeFalsy();
      expect("path" in (success?.result?.artifacts[0] ?? {})).toBeFalsy();
    }, async (...args) => {
      requestedUrls.push(String(args[0]));
      const callIndex = requestedUrls.length;

      if (callIndex === 1) {
        return new Response(
          JSON.stringify({
            kind: "pending",
            handle: {
              provider: "backend_render",
              requestId: "request-phase77",
              jobId: "job-phase77",
              status: "rendering",
            },
            progress: {
              stage: "rendering",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          kind: "terminal_success",
          result: {
            provider: "backend_render",
            requestId: "request-phase77",
            jobId: "job-phase77",
            artifacts: [
              {
                id: "artifact-phase77",
                status: "ready",
                bytes: 2048,
                metadata: { durationMs: 1500 },
              },
            ],
            completedAt: "2026-05-20T12:05:00.000Z",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });
  });

  test("refreshExportStatus requires a real handle jobId and reconnect maps terminal failure truthfully without unsafe details", async () => {
    const store = await getExportStore();
    const timelineIdNoHandle = "timeline-phase77-no-handle";
    store.setState({
      jobsByTimelineId: {
        [timelineIdNoHandle]: {
          timelineId: timelineIdNoHandle,
          requestId: "request-without-handle",
          lifecycle: "submitted",
          resumeState: "none",
        },
      },
    });

    let fetchCalls = 0;

    await withMockedFetch(async () => {
      const unchanged = await store.getState().refreshExportStatus(timelineIdNoHandle);

      expect(fetchCalls).toBe(0);
      expect(unchanged?.requestId).toBe("request-without-handle");
      expect(unchanged?.lifecycle).toBe("submitted");
    }, async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const timelineIdReconnect = "timeline-phase77-reconnect";
    saveExportHandle({
      timelineId: timelineIdReconnect,
      requestId: "request-phase77-reconnect",
      jobId: "job-phase77-reconnect",
      submittedAt: "2026-05-20T12:00:00.000Z",
    });

    await withMockedFetch(async () => {
      const result = await store.getState().reconnectExport(timelineIdReconnect);

      expect(result?.lifecycle).toBe("error");
      expect(result?.failure).toEqual({
        message: "Export job was not found.",
        code: "export_job_not_found",
      });
      expect(result?.failure?.details).toBeUndefined();
      expect(result?.handle).toBeUndefined();
    }, async (...args) => {
      fetchCalls += 1;
      expect(String(args[0])).toBe(
        "https://example.com/exports/job-phase77-reconnect",
      );

      return new Response(
        JSON.stringify({
          message: "Export job was not found.",
          code: "export_job_not_found",
        }),
        {
          status: 404,
          statusText: "Not Found",
          headers: { "Content-Type": "application/json" },
        },
      );
    });
  });

  test("source keeps frontend export lifecycle on service/store boundaries with no direct Supabase client or component fetch orchestration", async () => {
    const [
      exportStoreSource,
      exportServiceSource,
      exportHandleStorageSource,
      timelineExportPanelSource,
    ] = await Promise.all([
      fs.readFile(exportStorePath, "utf8"),
      fs.readFile(exportServicePath, "utf8"),
      fs.readFile(exportHandleStoragePath, "utf8"),
      fs.readFile(timelineExportPanelPath, "utf8"),
    ]);

    expect(exportStoreSource).toContain("pollExportJob(current.handle");
    expect(exportStoreSource).not.toContain("jobId: current.requestId");
    expect(exportStoreSource).not.toContain("createClient");
    expect(exportStoreSource).not.toContain("supabase");
    expect(exportStoreSource).not.toContain("signedUrl");
    expect(exportStoreSource).not.toContain("downloadUrl");
    expect(exportStoreSource).not.toContain("storageRef");

    expect(exportServiceSource).toContain("fetch(");
    expect(exportServiceSource).not.toContain("createClient");
    expect(exportServiceSource).not.toContain("@supabase");

    expect(exportHandleStorageSource).toContain("downloadUrl");
    expect(exportHandleStorageSource).toContain("signedUrl");
    expect(exportHandleStorageSource).toContain("filePath");

    expect(timelineExportPanelSource).not.toContain("fetch(");
    expect(timelineExportPanelSource).toContain("requestExport(");
    expect(timelineExportPanelSource).toContain("reconnectExport(");
    expect(timelineExportPanelSource).toContain("requestExportArtifactAccess(");
  });
});
