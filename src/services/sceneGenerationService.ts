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
      return generateMockScene(signal);
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
        return generateMockScene(signal);
      }

      if (!isGeneratedScene(body)) {
        return generateMockScene(signal);
      }

      return body;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      return generateMockScene(signal);
    }
  }
}

const generateMockScene = async (signal?: AbortSignal): Promise<GeneratedScene> => {
  await delay(randomDelay(), signal);
  console.info("[Mock] Scene generated");

  return {
    image: createPicsumUrl(),
    variations: [createPicsumUrl(), createPicsumUrl(), createPicsumUrl()],
  };
};

const randomDelay = (): number => 1500 + Math.random() * 1500;

const createPicsumUrl = (): string =>
  `https://picsum.photos/seed/${Math.random()}/512/512`;

const delay = (duration: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Scene generation was aborted.", "AbortError"));
      return;
    }

    const timeoutId = window.setTimeout(resolve, duration);

    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeoutId);
        reject(new DOMException("Scene generation was aborted.", "AbortError"));
      },
      { once: true },
    );
  });

const normalizeBaseUrl = (baseUrl?: string): string | undefined => {
  const trimmed = baseUrl?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : undefined;
};

const normalizePath = (path: string): string =>
  path.startsWith("/") ? path : `/${path}`;

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

const serviceConfig = {
  baseUrl: import.meta.env.VITE_SCENE_API_BASE_URL,
  generationPath: import.meta.env.VITE_SCENE_GENERATION_PATH,
};

export const replicateSceneGenerationService = new HttpSceneGenerationService({
  ...serviceConfig,
  provider: "replicate",
});

export const geminiSceneGenerationService = new HttpSceneGenerationService({
  ...serviceConfig,
  provider: "gemini",
});
