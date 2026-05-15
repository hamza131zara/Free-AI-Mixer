import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

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

async function getExportStoreModule() {
  return await import("../../src/store/exportStore");
}

async function getExportHandleStorageModule() {
  return await import("../../src/services/exportHandleStorage");
}

function writeCorruptHandleStorage(): void {
  mock.setItem(STORAGE_KEY, "not valid json {");
}

test.beforeEach(() => {
  installMock();
});

test.afterEach(() => {
  restoreMock();
});

test.describe("phase825 reconnect UI boundary", () => {
  test("store exposes reconnectExport and selectHasPersistedHandle", async () => {
    const { useExportStore, selectHasPersistedHandle } = await getExportStoreModule();

    expect(typeof useExportStore.getState().reconnectExport).toBe("function");
    expect(typeof selectHasPersistedHandle).toBe("function");
  });

  test("selectHasPersistedHandle returns true when persisted handle exists", async () => {
    const { useExportStore, selectHasPersistedHandle } = await getExportStoreModule();
    const { saveExportHandle } = await getExportHandleStorageModule();

    saveExportHandle({
      timelineId: "timeline-ui",
      jobId: "job-ui",
      requestId: "req-ui",
      submittedAt: "2026-05-15T10:00:00.000Z",
    });

    expect(selectHasPersistedHandle(useExportStore.getState(), "timeline-ui")).toBe(true);
  });

  test("selectHasPersistedHandle returns false when no persisted handle exists", async () => {
    const { useExportStore, selectHasPersistedHandle } = await getExportStoreModule();

    expect(selectHasPersistedHandle(useExportStore.getState(), "missing-timeline")).toBe(false);
  });

  test("selectHasPersistedHandle handles corrupt localStorage safely", async () => {
    const { useExportStore, selectHasPersistedHandle } = await getExportStoreModule();

    writeCorruptHandleStorage();

    expect(() => {
      expect(selectHasPersistedHandle(useExportStore.getState(), "timeline-corrupt")).toBe(false);
    }).not.toThrow();
  });

  test("TimelineExportPanel source contains reconnect button copy", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    expect(source).toContain("Reconnect export");
    expect(source).toContain("Reconnecting...");
  });

  test("TimelineExportPanel dispatches reconnectExport from button action", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    expect(source).toContain("reconnectExport");
    expect(source).toMatch(/reconnectExport\s*\(\s*timelineId\s*\)/);
  });

  test("TimelineExportPanel does not import storage or service layers directly", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    expect(source).not.toContain("exportHandleStorage");
    expect(source).not.toContain("exportService");
    expect(source).not.toContain("pollExportJob");
    expect(source).not.toContain("submitExportJob");
  });

  test("TimelineExportPanel does not auto-reconnect on mount", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/useEffect\s*\([^)]*reconnectExport/s);
  });

  test("exportStore source does not contain setInterval/setTimeout polling", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "store", "exportStore.ts"),
      "utf8",
    );

    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("setTimeout");
  });

  test("TimelineExportPanel source does not contain setInterval/setTimeout polling", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "components", "TimelineExportPanel.tsx"),
      "utf8",
    );

    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("setTimeout");
  });

  test("backend files remain outside Phase 8.25-B scope", async () => {
    await fs.access(path.join(process.cwd(), "backend", "routes", "exports.ts"));
    await fs.access(path.join(process.cwd(), "backend", "contracts", "exportHttpTypes.ts"));
  });
});