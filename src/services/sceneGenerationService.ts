import type {
  GeneratedScene,
  SceneGenerationError,
  SceneGenerationPayload,
  SceneProvider,
} from "../types/scene";

export interface SceneGenerationService {
  readonly provider: SceneProvider;
  generateScene(
    payload: SceneGenerationPayload,
    signal?: AbortSignal,
  ): Promise<GeneratedScene>;
}

export interface HttpSceneGenerationServiceConfig {
  baseUrl?: string;
  generationPath?: string;
  provider: SceneProvider;
}

interface SceneGenerationRuntimeConfig {
  baseUrl?: string;
  generationPath?: string;
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

  constructor(config: HttpSceneGenerationServiceConfig) {
    this.provider = config.provider;
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.generationPath = normalizePath(config.generationPath ?? "/scenes/generate");
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

const serviceConfig = {
  baseUrl: hasRuntimeConfigValue(runtimeConfig, "baseUrl")
    ? runtimeConfig.baseUrl
    : import.meta.env.VITE_SCENE_API_BASE_URL,
  generationPath: hasRuntimeConfigValue(runtimeConfig, "generationPath")
    ? runtimeConfig.generationPath
    : import.meta.env.VITE_SCENE_GENERATION_PATH,
};

export const replicateSceneGenerationService = new HttpSceneGenerationService({
  ...serviceConfig,
  provider: "replicate",
});

export const geminiSceneGenerationService = new HttpSceneGenerationService({
  ...serviceConfig,
  provider: "gemini",
});
