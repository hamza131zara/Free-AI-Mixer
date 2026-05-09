import {
  geminiSceneGenerationService,
  replicateSceneGenerationService,
  SceneGenerationServiceError,
  type SceneGenerationService,
} from "../services/sceneGenerationService";
import {
  scenePollingAgent,
  type ScenePollingAgent,
  type ScenePollingAgentEvents,
} from "./scenePollingAgent";
import type {
  GeneratedScene,
  SceneGenerationDraft,
  SceneGenerationPayload,
  SceneProvider,
} from "../types/scene";
import type {
  ProviderGenerationOutcome,
  ProviderJobFailure,
  ProviderJobSubmission,
  ProviderJobTerminalResult,
} from "../types/providerJob";

export interface SceneGenerationResult {
  provider: SceneProvider;
  scene: GeneratedScene;
}

export interface SceneGenerationAgentEvents {
  onProviderStart?: (provider: SceneProvider) => void;
  onProviderFallback?: (provider: SceneProvider, error: unknown) => void;
  onPollingAttempt?: (
    provider: SceneProvider,
    attempt: number,
    submission: ProviderJobSubmission,
  ) => void;
  onPollingPending?: (
    provider: SceneProvider,
    attempt: number,
    submission: ProviderJobSubmission,
  ) => void;
  onPollingTransientFailure?: (
    provider: SceneProvider,
    attempt: number,
    submission: ProviderJobSubmission,
    error: unknown,
  ) => void;
}

export interface SceneGenerationAgent {
  createPayload(draft: SceneGenerationDraft): SceneGenerationPayload;
  startGeneration(
    payload: SceneGenerationPayload,
    signal?: AbortSignal,
    events?: SceneGenerationAgentEvents,
  ): Promise<ProviderGenerationOutcome>;
  resolveGeneration(
    outcome: ProviderGenerationOutcome,
    signal?: AbortSignal,
    events?: SceneGenerationAgentEvents,
  ): Promise<SceneGenerationResult>;
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
    private readonly pollingAgent: ScenePollingAgent,
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

  async startGeneration(
    payload: SceneGenerationPayload,
    signal?: AbortSignal,
    events?: SceneGenerationAgentEvents,
  ): Promise<ProviderGenerationOutcome> {
    const primaryOutcome = await this.submitWithProvider(
      this.primaryService,
      payload,
      signal,
      events,
    );

    if (primaryOutcome.kind !== "failure") {
      return primaryOutcome;
    }

    events?.onProviderFallback?.(
      this.fallbackService.provider,
      primaryOutcome.error,
    );

    const fallbackOutcome = await this.submitWithProvider(
      this.fallbackService,
      payload,
      signal,
      events,
    );

    if (fallbackOutcome.kind !== "failure") {
      return fallbackOutcome;
    }

    return this.createFallbackFailure(primaryOutcome, fallbackOutcome);
  }

  async generateScene(
    payload: SceneGenerationPayload,
    signal?: AbortSignal,
    events?: SceneGenerationAgentEvents,
  ): Promise<SceneGenerationResult> {
    const outcome = await this.startGeneration(payload, signal, events);
    return this.resolveGeneration(outcome, signal, events);
  }

  async resolveGeneration(
    outcome: ProviderGenerationOutcome,
    signal?: AbortSignal,
    events?: SceneGenerationAgentEvents,
  ): Promise<SceneGenerationResult> {
    if (outcome.kind === "success") {
      return toSceneGenerationResult(outcome);
    }

    if (outcome.kind === "failure") {
      throw this.toProviderFailureError(outcome);
    }

    const service = this.getServiceForProvider(outcome.handle.provider);
    const submission = outcome;
    const pollingResult = await this.pollingAgent.pollUntilTerminal(
      service,
      outcome.handle,
      signal,
      toPollingEvents(events, submission),
    );

    if (pollingResult.kind === "failure") {
      throw this.toProviderFailureError(pollingResult.failure);
    }

    return toSceneGenerationResult(pollingResult.result);
  }

  private getServiceForProvider(provider: SceneProvider): SceneGenerationService {
    if (this.primaryService.provider === provider) {
      return this.primaryService;
    }

    if (this.fallbackService.provider === provider) {
      return this.fallbackService;
    }

    throw new SceneGenerationAgentError(
      `No scene generation service is registered for provider "${provider}".`,
      "unknown_provider",
    );
  }

  private toProviderFailureError(failure: ProviderJobFailure): SceneGenerationAgentError {
    const fallbackDetails =
      failure.error.details ??
      (typeof failure.metadata?.details === "object" &&
      failure.metadata.details !== null
        ? failure.metadata.details
        : undefined);

    return new SceneGenerationAgentError(
      failure.error.message,
      failure.error.code,
      fallbackDetails ?? {
        provider: failure.provider,
        jobId: failure.jobId,
        metadata: failure.metadata,
      },
    );
  }

  private async generateWithLegacyFallback(
    payload: SceneGenerationPayload,
    signal?: AbortSignal,
    events?: SceneGenerationAgentEvents,
  ): Promise<SceneGenerationResult> {
    try {
      return await this.generateWithProvider(
        this.primaryService,
        payload,
        signal,
        events,
      );
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

  private async submitWithProvider(
    service: SceneGenerationService,
    payload: SceneGenerationPayload,
    signal?: AbortSignal,
    events?: SceneGenerationAgentEvents,
  ): Promise<ProviderGenerationOutcome> {
    console.log("[Agent] Submitting provider job:", service.provider);
    events?.onProviderStart?.(service.provider);
    return service.submitGenerationJob(payload, signal);
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

  private createFallbackFailure(
    primary: ProviderJobFailure,
    fallback: ProviderJobFailure,
  ): ProviderJobFailure {
    const fallbackDetails = {
      primary: serializeProviderFailure(primary),
      fallback: serializeProviderFailure(fallback),
    };

    return {
      kind: "failure",
      provider: fallback.provider,
      jobId: fallback.jobId,
      error: {
        message: "Both scene generation providers failed.",
        code: "provider_fallback_failed",
        details: fallbackDetails,
      },
      metadata: {
        provider: fallback.provider,
        details: fallbackDetails,
      },
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

const serializeProviderFailure = (
  failure: ProviderJobFailure,
): {
  provider: SceneProvider;
  jobId?: string;
  message: string;
  code?: string;
  details?: unknown;
} => ({
  provider: failure.provider,
  jobId: failure.jobId,
  message: failure.error.message,
  code: failure.error.code,
  details: failure.error.details,
});

const serializeError = (error: unknown): unknown => {
  if (error instanceof SceneGenerationServiceError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      provider: error.provider,
      details: error.details,
    };
  }

  if (error instanceof SceneGenerationAgentError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      details: error.details,
    };
  }

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
  scenePollingAgent,
);

export type SceneGenerationStartResult =
  | ProviderJobTerminalResult
  | ProviderJobSubmission
  | ProviderJobFailure;

const toSceneGenerationResult = (
  result: ProviderJobTerminalResult,
): SceneGenerationResult => ({
  provider: result.provider,
  scene: result.scene,
});

const toPollingEvents = (
  events?: SceneGenerationAgentEvents,
  submission?: ProviderJobSubmission,
): ScenePollingAgentEvents | undefined =>
  events
    ? {
        onPollAttempt: (handle, attempt) => {
          if (submission) {
            events.onPollingAttempt?.(handle.provider, attempt, submission);
          }
        },
        onPollPending: (handle, attempt) => {
          if (submission) {
            events.onPollingPending?.(handle.provider, attempt, submission);
          }
        },
        onTransientFailure: (handle, attempt, failure) => {
          if (submission) {
            events.onPollingTransientFailure?.(
              handle.provider,
              attempt,
              submission,
              failure.error,
            );
          }
        },
      }
    : undefined;
