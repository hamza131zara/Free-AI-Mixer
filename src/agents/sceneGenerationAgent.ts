import {
  geminiSceneGenerationService,
  replicateSceneGenerationService,
  type SceneGenerationService,
} from "../services/sceneGenerationService";
import type {
  GeneratedScene,
  SceneGenerationDraft,
  SceneGenerationPayload,
  SceneProvider,
} from "../types/scene";

export interface SceneGenerationResult {
  provider: SceneProvider;
  scene: GeneratedScene;
}

export interface SceneGenerationAgentEvents {
  onProviderStart?: (provider: SceneProvider) => void;
  onProviderFallback?: (provider: SceneProvider, error: unknown) => void;
}

export interface SceneGenerationAgent {
  createPayload(draft: SceneGenerationDraft): SceneGenerationPayload;
  generateScene(
    payload: SceneGenerationPayload,
    signal?: AbortSignal,
    events?: SceneGenerationAgentEvents,
  ): Promise<SceneGenerationResult>;
}

export class SceneGenerationAgentError extends Error {
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "SceneGenerationAgentError";
    this.code = code;
    this.details = details;
  }
}

export class DefaultSceneGenerationAgent implements SceneGenerationAgent {
  constructor(
    private readonly primaryService: SceneGenerationService,
    private readonly fallbackService: SceneGenerationService,
  ) {}

  createPayload(draft: SceneGenerationDraft): SceneGenerationPayload {
    const prompt = draft.prompt.trim();

    if (!prompt) {
      throw new SceneGenerationAgentError(
        "A scene prompt is required.",
        "empty_prompt",
      );
    }

    return {
      prompt,
      style: toOptionalText(draft.style),
      duration: toOptionalDuration(draft.duration),
    };
  }

  async generateScene(
    payload: SceneGenerationPayload,
    signal?: AbortSignal,
    events?: SceneGenerationAgentEvents,
  ): Promise<SceneGenerationResult> {
    try {
      return await this.generateWithProvider(this.primaryService, payload, signal, events);
    } catch (primaryError) {
      if (isAbortError(primaryError)) {
        throw primaryError;
      }

      events?.onProviderFallback?.(this.fallbackService.provider, primaryError);

      try {
        return await this.generateWithProvider(
          this.fallbackService,
          payload,
          signal,
          events,
        );
      } catch (fallbackError) {
        if (isAbortError(fallbackError)) {
          throw fallbackError;
        }

        throw new SceneGenerationAgentError(
          "Both scene generation providers failed.",
          "provider_fallback_failed",
          {
            primary: serializeError(primaryError),
            fallback: serializeError(fallbackError),
          },
        );
      }
    }
  }

  private async generateWithProvider(
    service: SceneGenerationService,
    payload: SceneGenerationPayload,
    signal?: AbortSignal,
    events?: SceneGenerationAgentEvents,
  ): Promise<SceneGenerationResult> {
    console.log("[Agent] Using provider:", service.provider);
    events?.onProviderStart?.(service.provider);
    const scene = await service.generateScene(payload, signal);
    return {
      provider: service.provider,
      scene,
    };
  }
}

const toOptionalText = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const toOptionalDuration = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const duration = Number(trimmed);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new SceneGenerationAgentError(
      "Duration must be a positive number.",
      "invalid_duration",
    );
  }

  return duration;
};

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

const serializeError = (error: unknown): unknown => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return error;
};

export const sceneGenerationAgent = new DefaultSceneGenerationAgent(
  replicateSceneGenerationService,
  geminiSceneGenerationService,
);
