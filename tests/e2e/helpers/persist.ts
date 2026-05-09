export const persistKey = "free-ai-mixer-scenes";

export type SceneLifecycle =
  | "idle"
  | "queued"
  | "generating"
  | "success"
  | "error";

export type SceneProvider = "replicate" | "gemini";

export interface GeneratedScene {
  image: string;
  variations: string[];
}

export interface SceneGenerationError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface PersistedSceneProviderJobState {
  provider: SceneProvider;
  sceneId: string;
  jobId: string;
  status: string;
  remoteStatus?: string;
  submittedAt: string;
  lastPolledAt?: string;
  pollAttemptCount: number;
  timeoutAt: string;
  requestFingerprint: string;
  resumeVersion: number;
  resumeState?: string;
  label?: string;
}

export interface PersistedSceneRecord {
  id: string;
  lifecycle: SceneLifecycle;
  payload: {
    prompt: string;
    style?: string;
    duration?: number;
  };
  progress: number;
  provider?: SceneProvider;
  providerJob?: PersistedSceneProviderJobState;
  result?: GeneratedScene;
  selectedVariation?: string;
  error?: SceneGenerationError;
  createdAt: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface PersistedSceneStoreState {
  draft: {
    prompt: string;
    style: string;
    duration: string;
  };
  scenes: PersistedSceneRecord[];
}

const now = "2026-05-08T00:00:00.000Z";

export const createScene = (
  overrides: Partial<PersistedSceneRecord> & Pick<PersistedSceneRecord, "id">,
): PersistedSceneRecord => ({
  id: overrides.id,
  lifecycle: "idle",
  payload: {
    prompt: "Default scene prompt",
  },
  progress: 0,
  createdAt: now,
  ...overrides,
});

export const createPersistedStoreValue = (
  state: Partial<PersistedSceneStoreState>,
): string =>
  JSON.stringify({
    state: {
      draft: {
        prompt: "",
        style: "",
        duration: "",
        ...(state.draft ?? {}),
      },
      scenes: state.scenes ?? [],
    },
    version: 1,
  });
