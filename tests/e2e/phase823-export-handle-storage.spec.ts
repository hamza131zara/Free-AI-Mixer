import { expect, test } from "@playwright/test";
import * as fs from "node:fs";
import path from "node:path";

import {
  saveExportHandle,
  getExportHandle,
  getAllExportHandles,
  removeExportHandle,
  clearAllExportHandles,
} from "../../src/services/exportHandleStorage";

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

test.beforeEach(() => {
  installMock();
});

test.afterEach(() => {
  restoreMock();
});

test.describe("phase823 export handle storage", () => {
  test("saveExportHandle stores minimal handle", () => {
    saveExportHandle({
      timelineId: "timeline-1",
      jobId: "job-123",
      requestId: "req-456",
      submittedAt: "2026-05-15T10:00:00.000Z",
    });

    const raw = mock.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(1);
    expect(parsed.handles).toHaveLength(1);
    expect(parsed.handles[0].timelineId).toBe("timeline-1");
    expect(parsed.handles[0].jobId).toBe("job-123");
    expect(parsed.handles[0].requestId).toBe("req-456");
    expect(parsed.handles[0].submittedAt).toBe("2026-05-15T10:00:00.000Z");
    expect(parsed.updatedAt).toBeDefined();
  });

  test("getExportHandle loads by timelineId", () => {
    saveExportHandle({
      timelineId: "timeline-match",
      jobId: "job-abc",
      requestId: "req-def",
      submittedAt: "2026-05-15T10:00:00.000Z",
    });

    const handle = getExportHandle("timeline-match");

    expect(handle).toBeTruthy();
    expect(handle?.timelineId).toBe("timeline-match");
    expect(handle?.jobId).toBe("job-abc");
  });

  test("getExportHandle returns undefined for missing timelineId", () => {
    saveExportHandle({
      timelineId: "timeline-other",
      jobId: "job-123",
      requestId: "req-456",
      submittedAt: "2026-05-15T10:00:00.000Z",
    });

    const handle = getExportHandle("timeline-missing");

    expect(handle).toBeUndefined();
  });

  test("getAllExportHandles returns all valid handles", () => {
    saveExportHandle({ timelineId: "tl-1", jobId: "j-1", requestId: "r-1", submittedAt: "2026-05-15T10:00:00.000Z" });
    saveExportHandle({ timelineId: "tl-2", jobId: "j-2", requestId: "r-2", submittedAt: "2026-05-15T11:00:00.000Z" });

    const handles = getAllExportHandles();

    expect(handles).toHaveLength(2);
    expect(handles.map((h) => h.timelineId)).toContain("tl-1");
    expect(handles.map((h) => h.timelineId)).toContain("tl-2");
  });

  test("saveExportHandle upserts by timelineId", () => {
    saveExportHandle({ timelineId: "tl-upsert", jobId: "job-old", requestId: "req-old", submittedAt: "2026-05-15T10:00:00.000Z" });
    saveExportHandle({ timelineId: "tl-upsert", jobId: "job-new", requestId: "req-new", submittedAt: "2026-05-15T12:00:00.000Z" });

    const handles = getAllExportHandles();

    expect(handles).toHaveLength(1);
    expect(handles[0].jobId).toBe("job-new");
  });

  test("removeExportHandle removes one handle", () => {
    saveExportHandle({ timelineId: "tl-remove", jobId: "job-1", requestId: "req-1", submittedAt: "2026-05-15T10:00:00.000Z" });
    saveExportHandle({ timelineId: "tl-keep", jobId: "job-2", requestId: "req-2", submittedAt: "2026-05-15T11:00:00.000Z" });

    removeExportHandle("tl-remove");

    const handles = getAllExportHandles();

    expect(handles).toHaveLength(1);
    expect(handles[0].timelineId).toBe("tl-keep");
  });

  test("clearAllExportHandles removes storage", () => {
    saveExportHandle({ timelineId: "tl-1", jobId: "job-1", requestId: "req-1", submittedAt: "2026-05-15T10:00:00.000Z" });

    clearAllExportHandles();

    const raw = mock.getItem(STORAGE_KEY);
    expect(raw).toBeNull();
  });

  test("corrupt JSON is handled safely", () => {
    mock.setItem(STORAGE_KEY, "not valid json {");

    const handles = getAllExportHandles();

    expect(handles).toEqual([]);
  });

  test("unknown version is handled safely", () => {
    mock.setItem(STORAGE_KEY, JSON.stringify({ version: 999, handles: [], updatedAt: "2026-05-15T00:00:00.000Z" }));

    const handles = getAllExportHandles();

    expect(handles).toEqual([]);

    const raw = mock.getItem(STORAGE_KEY);
    expect(raw).toBeNull();
  });

  test("missing required fields are ignored", () => {
    saveExportHandle({ timelineId: "tl-1" } as Parameters<typeof saveExportHandle>[0]);

    const handles = getAllExportHandles();

    expect(handles).toEqual([]);
  });

  test("unsafe extra fields are not persisted", () => {
    saveExportHandle({
      timelineId: "tl-unsafe",
      jobId: "job-1",
      requestId: "req-1",
      submittedAt: "2026-05-15T10:00:00.000Z",
      path: "/etc/passwd",
      filePath: "C:\\Windows\\System32",
      url: "http://evil.com/artifact.mp4",
      artifactUrl: "http://evil.com/download",
      downloadUrl: "http://evil.com/file.mp4",
      signedUrl: "http://evil.com/signed",
      details: { secret: "value" },
      stack: "Error at...",
    } as unknown as Parameters<typeof saveExportHandle>[0]);

    const raw = mock.getItem(STORAGE_KEY)!;
    const parsed = JSON.parse(raw);

    const handle = parsed.handles[0];
    expect(handle.path).toBeUndefined();
    expect(handle.filePath).toBeUndefined();
    expect(handle.url).toBeUndefined();
    expect(handle.artifactUrl).toBeUndefined();
    expect(handle.downloadUrl).toBeUndefined();
    expect(handle.signedUrl).toBeUndefined();
    expect(handle.details).toBeUndefined();
    expect(handle.stack).toBeUndefined();
  });

  test("localStorage unavailable does not crash", () => {
    restoreMock();
    Object.defineProperty(globalThis, "localStorage", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(() => {
      saveExportHandle({ timelineId: "tl-1", jobId: "job-1", requestId: "req-1", submittedAt: "2026-05-15T10:00:00.000Z" });
      getExportHandle("tl-1");
      getAllExportHandles();
      removeExportHandle("tl-1");
      clearAllExportHandles();
    }).not.toThrow();

    installMock();
  });

  test("source does not import backend files", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "services", "exportHandleStorage.ts"), "utf8");

    expect(source).not.toContain("../backend");
    expect(source).not.toContain("backend/");
  });

  test("source does not import component files", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "services", "exportHandleStorage.ts"), "utf8");

    expect(source).not.toContain("../components");
    expect(source).not.toContain("components/");
  });

  test("source does not contain polling or download logic", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "services", "exportHandleStorage.ts"), "utf8");

    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("setTimeout");
    // downloadUrl/signedUrl/artifactUrl appear in FORBIDDEN_FIELDS denylist - that's safety code, not download logic
    // Instead check for actual download behavior patterns
    expect(source).not.toContain(".click()");
    expect(source).not.toContain("createObjectURL");
    expect(source).not.toContain("window.location");
    expect(source).not.toContain("href =");
  });
});