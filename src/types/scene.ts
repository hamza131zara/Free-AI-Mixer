export type SceneLifecycle = "idle" | "queued" | "generating" | "success" | "error";

export type SceneProvider = "replicate" | "gemini";

// This is an internal app lifecycle milestone value, not provider-reported telemetry.
export type SceneProgress = number;

export interface SceneGenerationDraft {
  prompt: string;
  style: string;
  duration: string;
}

export interface SceneGenerationPayload {
  prompt: string;
  style?: string;
  duration?: number;
}

export interface GeneratedScene {
  image: string;
  variations: string[];
}

export interface SceneGenerationError {
  message: string;
  code?: string;
  details?: unknown;
}

export type SceneProviderJobResumeState =
  | "runtime_active"
  | "resume_in_progress"
  | "resume_needed"
  | "resume_unavailable"
  | "expired";

export interface SceneProviderJobState {
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
  resumeState?: SceneProviderJobResumeState;
  label?: string;
}

export interface SceneRecord {
  id: string;
  lifecycle: SceneLifecycle;
  payload: SceneGenerationPayload;
  progress: SceneProgress;
  provider?: SceneProvider;
  providerJob?: SceneProviderJobState;
  result?: GeneratedScene;
  selectedVariation?: string;
  error?: SceneGenerationError;
  createdAt: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
}
