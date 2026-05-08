export type SceneLifecycle = "idle" | "queued" | "generating" | "success" | "error";

export type SceneProvider = "replicate" | "gemini";

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

export interface SceneRecord {
  id: string;
  lifecycle: SceneLifecycle;
  payload: SceneGenerationPayload;
  progress: SceneProgress;
  provider?: SceneProvider;
  result?: GeneratedScene;
  selectedVariation?: string;
  error?: SceneGenerationError;
  createdAt: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
}
