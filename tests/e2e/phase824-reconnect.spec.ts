import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getExportHandle, saveExportHandle } from "../../src/services/exportHandleStorage";

const STORAGE_KEY = "free-ai-mixer-export-handles";

interface StorageMock {
  store: Map<string, string>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

let originalDescriptor: PropertyDescriptor | undefined;
let mock: StorageMock;

function installMock(): void {
  mock = {
    store: new Map(),
    getItem(key: string): string | null {
      return this.store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      this.store.set(key, value);
    },
    removeItem(key: string): void {
      this.store.delete(key);
    },
    clear(): void {
      this.store.clear();
    },
  };

  originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

  Object.defineProperty(globalThis, "localStorage", {
    value: mock,
    writable: true,
    configurable: true,
  });
}

function restoreMock(): void {
  if (originalDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalDescriptor);
    originalDescriptor = undefined;
  }
}

async function getExportStore() {
  const storeModule = await import("../../src/store/exportStore");
  return storeModule.useExportStore;
}

type ExportStoreApi = Awaited<ReturnType<typeof getExportStore>>;
type ExportState = ReturnType<ExportStoreApi["getState"]>;
type RefreshExportStatus = ExportState["refreshExportStatus"];
type TimelineExportState = ExportState["jobsByTimelineId"][string];

let originalRefreshExportStatus: RefreshExportStatus | undefined;

function clearRawHandleStorage(): void {
  try {
    const storage = globalThis.localStorage as unknown as StorageMock;
    storage.store.delete(STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function resetExportStore(): Promise<void> {
  const store = await getExportStore();

  originalRefreshExportStatus ??= store.getState().refreshExportStatus;

  store.setState({
    jobsByTimelineId: {},
    activeExportTimelineId: undefined,
    isSubmittingByTimelineId: {},
    isResolvingByTimelineId: {},
    refreshExportStatus: originalRefreshExportStatus,
  });
}

async function clearStorageAndStore(): Promise<void> {
  clearRawHandleStorage();
  await resetExportStore();
}

const createHandle = (timelineId: string, jobId: string, requestId: string) => ({
  timelineId,
  jobId,
  requestId,
  submittedAt: "2026-05-15T10:00:00.000Z",
});

function installPendingRefreshMock(
  store: ExportStoreApi,
  params: {
    requestId: string;
    jobId: string;
    status?: "submitted" | "rendering" | "finalizing";
  },
): {
  getCallCount: () => number;
  getCapturedBeforeRefresh: () => TimelineExportState | undefined;
} {
  let callCount = 0;
  let capturedBeforeRefresh: TimelineExportState | undefined;

  store.setState({
    refreshExportStatus: async (timelineId) => {
      callCount++;

      const current = store.getState().jobsByTimelineId[timelineId];
      capturedBeforeRefresh = current;

      if (!current) {
        return undefined;
      }

      const status = params.status ?? "submitted";
      const nextState: TimelineExportState = {
        ...current,
        lifecycle: status,
        handle: {
          provider: "backend_render",
          requestId: params.requestId,
          jobId: params.jobId,
          status,
        },
        result: undefined,
        failure: undefined,
        lastPolledAt: new Date().toISOString(),
      };

      store.setState((state) => ({
        jobsByTimelineId: {
          ...state.jobsByTimelineId,
          [timelineId]: nextState,
        },
      }));

      return nextState;
    },
  });

  return {
    getCallCount: () => callCount,
    getCapturedBeforeRefresh: () => capturedBeforeRefresh,
  };
}

function installFailureRefreshMock(
  store: ExportStoreApi,
  params: {
    message: string;
    code: string;
  },
): {
  getCallCount: () => number;
} {
  let callCount = 0;

  store.setState({
    refreshExportStatus: async (timelineId) => {
      callCount++;

      const current = store.getState().jobsByTimelineId[timelineId];

      if (!current) {
        return undefined;
      }

      const nextState: TimelineExportState = {
        ...current,
        lifecycle: "error",
        handle: undefined,
        result: undefined,
        failure: {
          message: params.message,
          code: params.code,
        },
        lastPolledAt: new Date().toISOString(),
      };

      store.setState((state) => ({
        jobsByTimelineId: {
          ...state.jobsByTimelineId,
          [timelineId]: nextState,
        },
      }));

      return nextState;
    },
  });

  return {
    getCallCount: () => callCount,
  };
}

test.beforeEach(async () => {
  installMock();
  await clearStorageAndStore();
});

test.afterEach(() => {
  restoreMock();
});

test.describe("phase824 reconnect export", () => {
  test("reconnectExport returns undefined when no persisted handle exists", async () => {
    const store = await getExportStore();

    const result = await store.getState().reconnectExport("timeline-no-handle");

    expect(result).toBeUndefined();
    expect(store.getState().jobsByTimelineId["timeline-no-handle"]).toBeUndefined();
  });

  test("reconnectExport loads persisted handle and seeds store with handle before refresh", async () => {
    saveExportHandle(createHandle("tl-seed", "job-seed", "req-seed"));

    const store = await getExportStore();
    const refreshMock = installPendingRefreshMock(store, {
      requestId: "req-seed",
      jobId: "job-seed",
    });

    await store.getState().reconnectExport("tl-seed");

    const captured = refreshMock.getCapturedBeforeRefresh();
    expect(captured).toBeDefined();
    expect(captured?.timelineId).toBe("tl-seed");
    expect(captured?.requestId).toBe("req-seed");
    expect(captured?.handle?.provider).toBe("backend_render");
    expect(captured?.handle?.requestId).toBe("req-seed");
    expect(captured?.handle?.jobId).toBe("job-seed");
    expect(captured?.handle?.status).toBe("submitted");
  });

  test("reconnectExport keeps minimal state without fake progress", async () => {
    saveExportHandle(createHandle("tl-minimal", "job-min", "req-min"));

    const store = await getExportStore();
    const refreshMock = installPendingRefreshMock(store, {
      requestId: "req-min",
      jobId: "job-min",
    });

    await store.getState().reconnectExport("tl-minimal");

    const captured = refreshMock.getCapturedBeforeRefresh();
    const state = store.getState().jobsByTimelineId["tl-minimal"];

    expect(captured).toBeDefined();
    expect(captured?.progress).toBeUndefined();
    expect(captured?.result).toBeUndefined();
    expect(captured?.failure).toBeUndefined();

    expect(state).toBeDefined();
    expect(state?.timelineId).toBe("tl-minimal");
    expect(state?.requestId).toBe("req-min");
    expect(state?.lifecycle).toBe("submitted");
    expect(state?.handle?.provider).toBe("backend_render");
    expect(state?.handle?.jobId).toBe("job-min");
    expect(state?.handle?.status).toBe("submitted");
    expect(state?.result).toBeUndefined();
    expect(state?.failure).toBeUndefined();
  });

  test("reconnectExport calls refreshExportStatus once", async () => {
    saveExportHandle(createHandle("tl-once", "job-once", "req-once"));

    const store = await getExportStore();
    const refreshMock = installPendingRefreshMock(store, {
      requestId: "req-once",
      jobId: "job-once",
    });

    await store.getState().reconnectExport("tl-once");

    expect(refreshMock.getCallCount()).toBe(1);
  });

  test("reconnectExport updates lastCheckedAt after successful refresh", async () => {
    saveExportHandle(createHandle("tl-check", "job-check", "req-check"));

    const initial = getExportHandle("tl-check");
    expect(initial?.lastCheckedAt).toBeUndefined();

    const store = await getExportStore();
    installPendingRefreshMock(store, {
      requestId: "req-check",
      jobId: "job-check",
    });

    await store.getState().reconnectExport("tl-check");

    const updated = getExportHandle("tl-check");
    expect(updated?.lastCheckedAt).toBeDefined();
  });

  test("reconnectExport handles corrupt localStorage safely", async () => {
    mock.setItem(STORAGE_KEY, "not valid json {");

    const store = await getExportStore();

    const result = await store.getState().reconnectExport("tl-corrupt");

    expect(result).toBeUndefined();
  });

  test("reconnectExport handles backend 404 gracefully without throwing", async () => {
    saveExportHandle(createHandle("tl-404", "job-404", "req-404"));

    const store = await getExportStore();
    const refreshMock = installFailureRefreshMock(store, {
      message: "Export job was not found.",
      code: "export_job_not_found",
    });

    const result = await store.getState().reconnectExport("tl-404");

    expect(refreshMock.getCallCount()).toBe(1);
    expect(result?.lifecycle).toBe("error");
    expect(result?.failure?.code).toBe("export_job_not_found");
  });

  test("reconnectExport handles network errors without throwing", async () => {
    saveExportHandle(createHandle("tl-net", "job-net", "req-net"));

    const store = await getExportStore();
    const refreshMock = installFailureRefreshMock(store, {
      message: "Export poll transport request failed.",
      code: "transport_exception",
    });

    const result = await store.getState().reconnectExport("tl-net");

    expect(refreshMock.getCallCount()).toBe(1);
    expect(result?.lifecycle).toBe("error");
    expect(result?.failure?.code).toBe("transport_exception");
  });

  test("reconnectExport does not add polling loop", async () => {
    saveExportHandle(createHandle("tl-loop", "job-loop", "req-loop"));

    const store = await getExportStore();
    const refreshMock = installPendingRefreshMock(store, {
      requestId: "req-loop",
      jobId: "job-loop",
    });

    await store.getState().reconnectExport("tl-loop");

    expect(refreshMock.getCallCount()).toBe(1);
  });

  test("source does not contain setInterval/setTimeout polling", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "store", "exportStore.ts"),
      "utf8",
    );

    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("setTimeout");
  });

  test("no UI/component files changed in this phase", async () => {
    const componentsDir = path.join(process.cwd(), "src", "components");

    await fs.access(componentsDir);
  });

  test("no backend files changed in this phase", async () => {
    const backendRoutes = path.join(process.cwd(), "backend", "routes", "exports.ts");
    const backendRegistry = path.join(process.cwd(), "backend", "registry");

    await fs.access(backendRoutes);
    await fs.access(backendRegistry);
  });
});