import type {
  GeneratedScene,
  SceneGenerationError,
  SceneGenerationPayload,
  SceneProvider,
} from "../types/scene";
import type {
  ProviderGenerationOutcome,
  ProviderJobActiveStatus,
  ProviderJobFailure,
  ProviderJobHandle,
  ProviderJobMetadata,
  ProviderJobPollResult,
  ProviderJobTerminalResult,
} from "../types/providerJob";

export interface SceneGenerationService {
  readonly provider: SceneProvider;
  submitGenerationJob(
    payload: SceneGenerationPayload,
    signal?: AbortSignal,
  ): Promise<ProviderGenerationOutcome>;
  pollGenerationJob(
    handle: ProviderJobHandle,
    signal?: AbortSignal,
  ): Promise<ProviderJobPollResult>;
  normalizeTerminalResult(result: ProviderJobTerminalResult): GeneratedScene;
  generateScene(
    payload: SceneGenerationPayload,
    signal?: AbortSignal,
  ): Promise<GeneratedScene>;
}

export interface HttpSceneGenerationServiceConfig {
  baseUrl?: string;
  generationPath?: string;
  pollPath?: string;
  provider: SceneProvider;
}

interface SceneGenerationRuntimeConfig {
  baseUrl?: string;
  generationPath?: string;
  pollPath?: string;
  pollTimeoutMs?: number;
  maxTransientPollFailures?: number;
  pollDelayMs?: number;
}

declare global {
  interface Window {
    __FREE_AI_MIXER_RUNTIME_CONFIG__?: SceneGenerationRuntimeConfig;
  }
}

export class SceneGenerationServiceError extends Error {
  readonly code?: string;
  readonly details?: unknown;
  readonly provider?: SceneProvider;

  constructor(error: SceneGenerationError & { provider?: SceneProvider }) {
    super(error.message);
    this.name = "SceneGenerationServiceError";
    this.code = error.code;
    this.details = error.details;
    this.provider = error.provider;
  }
}

export class HttpSceneGenerationService implements SceneGenerationService {
  readonly provider: SceneProvider;
  private readonly baseUrl?: string;
  private readonly generationPath: string;
  private readonly pollPath: string;

  constructor(config: HttpSceneGenerationServiceConfig) {
    this.provider = config.provider;
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.generationPath = normalizePath(config.generationPath ?? "/scenes/generate");
    this.pollPath = normalizePath(config.pollPath ?? "/scenes/jobs");
  }

  async submitGenerationJob(
    payload: SceneGenerationPayload,
    signal?: AbortSignal,
  ): Promise<ProviderGenerationOutcome> {
    console.log("[Service] Submitting provider generation job");

    if (!this.baseUrl) {
      return createFailureResult(
        this.provider,
        new SceneGenerationServiceError({
          message: "Scene generation API base URL is not configured.",
          code: "missing_api_base_url",
          details: {
            generationPath: this.generationPath,
          },
          provider: this.provider,
        }),
      );
    }

    try {
      const response = await fetch(`${this.baseUrl}${this.generationPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Scene-Provider": this.provider,
        },
        body: JSON.stringify(payload),
        signal,
      });

      const body = await readJson(response);

      if (!response.ok) {
        return createFailureResult(
          this.provider,
          new SceneGenerationServiceError({
            message: `Scene generation request failed with status ${response.status}.`,
            code: "http_error",
            details: {
              status: response.status,
              statusText: response.statusText,
              body,
            },
            provider: this.provider,
          }),
        );
      }

      if (isGeneratedScene(body)) {
        return {
          kind: "success",
          provider: this.provider,
          scene: body,
          metadata: {
            provider: this.provider,
          },
        };
      }

      const submission = toProviderJobSubmission(this.provider, body);
      if (submission) {
        return submission;
      }

      return createFailureResult(
        this.provider,
        new SceneGenerationServiceError({
          message: "Scene generation response payload is invalid.",
          code: "invalid_response_payload",
          details: {
            body,
          },
          provider: this.provider,
        }),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      return createFailureResult(
        this.provider,
        toServiceError(
          this.provider,
          error,
          "Scene generation transport request failed.",
        ),
      );
    }
  }

  async pollGenerationJob(
    handle: ProviderJobHandle,
    signal?: AbortSignal,
  ): Promise<ProviderJobPollResult> {
    console.log("[Service] Polling provider generation job");

    if (!this.baseUrl) {
      return {
        kind: "failure",
        failure: createFailureResult(
          this.provider,
          new SceneGenerationServiceError({
            message: "Scene generation API base URL is not configured.",
            code: "missing_api_base_url",
            details: {
              pollPath: this.pollPath,
            },
            provider: this.provider,
          }),
          handle.jobId,
        ),
      };
    }

    try {
      const response = await fetch(
        `${this.baseUrl}${this.pollPath}/${encodeURIComponent(handle.jobId)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Scene-Provider": handle.provider,
          },
          signal,
        },
      );

      const body = await readJson(response);

      if (!response.ok) {
        return {
          kind: "failure",
          failure: createFailureResult(
            handle.provider,
            new SceneGenerationServiceError({
              message: `Scene generation poll request failed with status ${response.status}.`,
              code: "http_error",
              details: {
                status: response.status,
                statusText: response.statusText,
                body,
              },
              provider: handle.provider,
            }),
            handle.jobId,
          ),
        };
      }

      const pendingHandle = toPendingProviderJobHandle(
        handle.provider,
        handle.jobId,
        body,
      );
      if (pendingHandle) {
        return {
          kind: "pending",
          handle: pendingHandle,
        };
      }

      if (isGeneratedScene(body)) {
        return {
          kind: "success",
          result: {
            kind: "success",
            provider: handle.provider,
            scene: body,
            metadata: {
              provider: handle.provider,
              details: body,
            },
          },
        };
      }

      const terminalFailure = toProviderJobFailure(
        handle.provider,
        handle.jobId,
        body,
      );
      if (terminalFailure) {
        return {
          kind: "failure",
          failure: terminalFailure,
        };
      }

      return {
        kind: "failure",
        failure: createFailureResult(
          handle.provider,
          new SceneGenerationServiceError({
            message: "Scene generation poll response payload is invalid.",
            code: "invalid_response_payload",
            details: {
              body,
            },
            provider: handle.provider,
          }),
          handle.jobId,
        ),
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      return {
        kind: "failure",
        failure: createFailureResult(
          handle.provider,
          toServiceError(
            handle.provider,
            error,
            "Scene generation poll transport request failed.",
          ),
          handle.jobId,
        ),
      };
    }
  }

  normalizeTerminalResult(result: ProviderJobTerminalResult): GeneratedScene {
    return result.scene;
  }

  async generateScene(
    payload: SceneGenerationPayload,
    signal?: AbortSignal,
  ): Promise<GeneratedScene> {
    console.log("[Service] Calling API");

    if (!this.baseUrl) {
      throw new SceneGenerationServiceError({
        message: "Scene generation API base URL is not configured.",
        code: "missing_api_base_url",
        details: {
          generationPath: this.generationPath,
        },
        provider: this.provider,
      });
    }

    try {
      const response = await fetch(`${this.baseUrl}${this.generationPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Scene-Provider": this.provider,
        },
        body: JSON.stringify(payload),
        signal,
      });

      const body = await readJson(response);

      if (!response.ok) {
        throw new SceneGenerationServiceError({
          message: `Scene generation request failed with status ${response.status}.`,
          code: "http_error",
          details: {
            status: response.status,
            statusText: response.statusText,
            body,
          },
          provider: this.provider,
        });
      }

      if (!isGeneratedScene(body)) {
        throw new SceneGenerationServiceError({
          message: "Scene generation response payload is invalid.",
          code: "invalid_response_payload",
          details: {
            body,
          },
          provider: this.provider,
        });
      }

      return body;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      if (error instanceof SceneGenerationServiceError) {
        throw error;
      }

      throw new SceneGenerationServiceError({
        message: "Scene generation transport request failed.",
        code: "transport_exception",
        details: serializeUnknownError(error),
        provider: this.provider,
      });
    }
  }
}

const providerJobActiveStatuses = new Set<ProviderJobActiveStatus>([
  "submitted",
  "pending",
  "polling",
  "processing",
]);

const providerJobTerminalFailureStatuses = new Set(["failed", "canceled"]);

const normalizeBaseUrl = (baseUrl?: string): string | undefined => {
  const trimmed = baseUrl?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : undefined;
};

const normalizePath = (path: string): string =>
  path.startsWith("/") ? path : `/${path}`;

const resolveRuntimeConfig = (): SceneGenerationRuntimeConfig => {
  if (typeof window === "undefined") {
    return {};
  }

  return window.__FREE_AI_MIXER_RUNTIME_CONFIG__ ?? {};
};

const hasRuntimeConfigValue = (
  config: SceneGenerationRuntimeConfig,
  key: keyof SceneGenerationRuntimeConfig,
): boolean => Object.prototype.hasOwnProperty.call(config, key);

const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const isGeneratedScene = (value: unknown): value is GeneratedScene => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const scene = value as Partial<GeneratedScene>;
  return (
    typeof scene.image === "string" &&
    Array.isArray(scene.variations) &&
    scene.variations.every((variation) => typeof variation === "string")
  );
};

const toProviderJobSubmission = (
  provider: SceneProvider,
  value: unknown,
): Extract<ProviderGenerationOutcome, { kind: "submitted" }> | undefined => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = value as {
    jobId?: unknown;
    status?: unknown;
    metadata?: unknown;
  };

  if (
    typeof candidate.jobId !== "string" ||
    typeof candidate.status !== "string" ||
    !providerJobActiveStatuses.has(candidate.status as ProviderJobActiveStatus)
  ) {
    return undefined;
  }

  return {
    kind: "submitted",
    handle: {
      provider,
      jobId: candidate.jobId,
      status: candidate.status as ProviderJobActiveStatus,
      metadata: toProviderJobMetadata(provider, candidate.metadata, value),
    },
  };
};

const toPendingProviderJobHandle = (
  provider: SceneProvider,
  fallbackJobId: string,
  value: unknown,
): ProviderJobHandle | undefined => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = value as {
    jobId?: unknown;
    status?: unknown;
    metadata?: unknown;
  };

  if (
    typeof candidate.status !== "string" ||
    !providerJobActiveStatuses.has(candidate.status as ProviderJobActiveStatus)
  ) {
    return undefined;
  }

  return {
    provider,
    jobId: typeof candidate.jobId === "string" ? candidate.jobId : fallbackJobId,
    status: candidate.status as ProviderJobActiveStatus,
    metadata: toProviderJobMetadata(provider, candidate.metadata, value),
  };
};

const toProviderJobFailure = (
  provider: SceneProvider,
  fallbackJobId: string,
  value: unknown,
): ProviderJobFailure | undefined => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = value as {
    jobId?: unknown;
    status?: unknown;
    error?: unknown;
    message?: unknown;
    code?: unknown;
    metadata?: unknown;
  };

  const status =
    typeof candidate.status === "string" ? candidate.status : undefined;

  if (!status || !providerJobTerminalFailureStatuses.has(status)) {
    return undefined;
  }

  const error = toSceneGenerationError(
    candidate.error,
    candidate.message,
    candidate.code,
    value,
  );

  return {
    kind: "failure",
    provider,
    jobId: typeof candidate.jobId === "string" ? candidate.jobId : fallbackJobId,
    error,
    metadata: toProviderJobMetadata(provider, candidate.metadata, value),
  };
};

const toSceneGenerationError = (
  errorValue: unknown,
  fallbackMessage: unknown,
  fallbackCode: unknown,
  details: unknown,
): SceneGenerationError => {
  if (typeof errorValue === "object" && errorValue !== null) {
    const error = errorValue as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
    };

    if (typeof error.message === "string") {
      return {
        message: error.message,
        code: typeof error.code === "string" ? error.code : undefined,
        details: error.details,
      };
    }
  }

  return {
    message:
      typeof fallbackMessage === "string"
        ? fallbackMessage
        : "Provider job failed.",
    code: typeof fallbackCode === "string" ? fallbackCode : undefined,
    details,
  };
};

const toProviderJobMetadata = (
  provider: SceneProvider,
  metadata: unknown,
  details: unknown,
): ProviderJobMetadata => {
  const candidate =
    typeof metadata === "object" && metadata !== null
      ? (metadata as {
          createdAt?: unknown;
          acceptedAt?: unknown;
          completedAt?: unknown;
          statusMessage?: unknown;
          pollAfterMs?: unknown;
          attemptCount?: unknown;
          remoteStatus?: unknown;
          details?: unknown;
        })
      : undefined;

  return {
    provider,
    createdAt:
      typeof candidate?.createdAt === "string" ? candidate.createdAt : undefined,
    acceptedAt:
      typeof candidate?.acceptedAt === "string" ? candidate.acceptedAt : undefined,
    completedAt:
      typeof candidate?.completedAt === "string" ? candidate.completedAt : undefined,
    statusMessage:
      typeof candidate?.statusMessage === "string"
        ? candidate.statusMessage
        : undefined,
    pollAfterMs:
      typeof candidate?.pollAfterMs === "number" ? candidate.pollAfterMs : undefined,
    attemptCount:
      typeof candidate?.attemptCount === "number" ? candidate.attemptCount : undefined,
    remoteStatus:
      typeof candidate?.remoteStatus === "string"
        ? candidate.remoteStatus
        : undefined,
    details: candidate?.details ?? details,
  };
};

const createFailureResult = (
  provider: SceneProvider,
  error: SceneGenerationServiceError,
  jobId?: string,
): ProviderJobFailure => ({
  kind: "failure",
  provider,
  jobId,
  error: {
    message: error.message,
    code: error.code,
    details: {
      provider: error.provider,
      cause: error.details,
    },
  },
  metadata: {
    provider,
  },
});

const toServiceError = (
  provider: SceneProvider,
  error: unknown,
  message: string,
): SceneGenerationServiceError => {
  if (error instanceof SceneGenerationServiceError) {
    return error;
  }

  return new SceneGenerationServiceError({
    message,
    code: "transport_exception",
    details: serializeUnknownError(error),
    provider,
  });
};

const serializeUnknownError = (error: unknown): unknown => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return error;
};

const runtimeConfig = resolveRuntimeConfig();
const env = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env;

const serviceConfig = {
  baseUrl: hasRuntimeConfigValue(runtimeConfig, "baseUrl")
    ? runtimeConfig.baseUrl
    : env?.VITE_SCENE_API_BASE_URL,
  generationPath: hasRuntimeConfigValue(runtimeConfig, "generationPath")
    ? runtimeConfig.generationPath
    : env?.VITE_SCENE_GENERATION_PATH,
  pollPath: hasRuntimeConfigValue(runtimeConfig, "pollPath")
    ? runtimeConfig.pollPath
    : env?.VITE_SCENE_POLL_PATH,
};

export const replicateSceneGenerationService = new HttpSceneGenerationService({
  ...serviceConfig,
  provider: "replicate",
});

export const geminiSceneGenerationService = new HttpSceneGenerationService({
  ...serviceConfig,
  provider: "gemini",
});
