/**
 * Phase 8.23-B: Frontend persisted export handle storage boundary.
 *
 * Minimal, versioned frontend storage for export handles.
 * Enables future reconnect UX without persisting full backend state.
 *
 * Must never persist:
 * - local paths, filePath, path, url, artifactUrl, downloadUrl, signedUrl
 * - failure.details, stack traces, provider credentials
 * - raw artifact blobs, backend internals, progress percentages
 */

const STORAGE_KEY = "free-ai-mixer-export-handles";
const SCHEMA_VERSION = 1;

export interface PersistedExportHandle {
  timelineId: string;
  jobId: string;
  requestId: string;
  submittedAt: string;
  lastCheckedAt?: string;
}

interface PersistedStore {
  version: number;
  handles: PersistedExportHandle[];
  updatedAt: string;
}

// Fields that must never be persisted
const FORBIDDEN_FIELDS = new Set([
  "path",
  "filePath",
  "url",
  "artifactUrl",
  "downloadUrl",
  "signedUrl",
  "details",
  "stack",
  "provider",
  "artifacts",
  "failure",
  "progress",
  "percent",
  "blob",
]);

const isSafeField = (key: string): boolean => !FORBIDDEN_FIELDS.has(key);

const getStorage = (): Storage | null => {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    // Verify it's functional
    const testKey = "__storage_test__";
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    return storage;
  } catch {
    return null;
  }
};

const readStorage = (): PersistedStore | null => {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;

    if (typeof parsed !== "object" || parsed === null) return null;

    const candidate = parsed as Partial<PersistedStore>;

    // Unknown version - clear data
    if (typeof candidate.version !== "number" || candidate.version !== SCHEMA_VERSION) {
      clearAllExportHandles();
      return null;
    }

    if (!Array.isArray(candidate.handles)) return null;
    if (typeof candidate.updatedAt !== "string") return null;

    return {
      version: candidate.version,
      handles: candidate.handles,
      updatedAt: candidate.updatedAt,
    };
  } catch {
    // Corrupt JSON - clear data
    clearAllExportHandles();
    return null;
  }
};

const writeStorage = (store: PersistedStore): void => {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage write failed - ignore silently
  }
};

const sanitizeHandle = (handle: Partial<PersistedExportHandle>): PersistedExportHandle | null => {
  if (typeof handle.timelineId !== "string" || !handle.timelineId) return null;
  if (typeof handle.jobId !== "string" || !handle.jobId) return null;
  if (typeof handle.requestId !== "string" || !handle.requestId) return null;
  if (typeof handle.submittedAt !== "string" || !handle.submittedAt) return null;

  // Only safe fields allowed
  const sanitized: PersistedExportHandle = {
    timelineId: handle.timelineId,
    jobId: handle.jobId,
    requestId: handle.requestId,
    submittedAt: handle.submittedAt,
  };

  if (typeof handle.lastCheckedAt === "string" && handle.lastCheckedAt) {
    sanitized.lastCheckedAt = handle.lastCheckedAt;
  }

  return sanitized;
};

const hasUnsafeFields = (obj: unknown): boolean => {
  if (typeof obj !== "object" || obj === null) return false;
  if (Array.isArray(obj)) {
    return obj.some(hasUnsafeFields);
  }
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (!isSafeField(key)) return true;
    if (hasUnsafeFields((obj as Record<string, unknown>)[key])) return true;
  }
  return false;
};

export const saveExportHandle = (handle: PersistedExportHandle): void => {
  // sanitizeHandle is the single allowlist filter - strips unsafe fields automatically
  const sanitized = sanitizeHandle(handle);
  if (!sanitized) return;

  const store = readStorage() ?? {
    version: SCHEMA_VERSION,
    handles: [],
    updatedAt: new Date().toISOString(),
  };

  // Upsert by timelineId
  const existingIndex = store.handles.findIndex((h) => h.timelineId === sanitized.timelineId);
  if (existingIndex >= 0) {
    store.handles[existingIndex] = sanitized;
  } else {
    store.handles.push(sanitized);
  }

  store.updatedAt = new Date().toISOString();
  writeStorage(store);
};

export const getExportHandle = (timelineId: string): PersistedExportHandle | undefined => {
  const store = readStorage();
  if (!store) return undefined;

  const handle = store.handles.find((h) => h.timelineId === timelineId);
  if (!handle) return undefined;

  // Re-validate on read
  return sanitizeHandle(handle) ?? undefined;
};

export const getAllExportHandles = (): PersistedExportHandle[] => {
  const store = readStorage();
  if (!store) return [];

  return store.handles
    .map((handle) => sanitizeHandle(handle))
    .filter((handle): handle is PersistedExportHandle => handle !== null);
};

export const removeExportHandle = (timelineId: string): void => {
  const store = readStorage();
  if (!store) return;

  store.handles = store.handles.filter((h) => h.timelineId !== timelineId);
  store.updatedAt = new Date().toISOString();
  writeStorage(store);
};

export const clearAllExportHandles = (): void => {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
};