import { fetchWithOptionalAccountBearer } from "./auth/authenticatedFetch";
import type {
  PromptGenerationRequest,
  PromptImageGenerationRequest,
  PromptVideoGenerationRequest,
  PromptImageGenerationHistoryEntry,
  PromptImageGenerationResponse,
} from "../types/imageGeneration";

export class ImageGenerationServiceError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ImageGenerationServiceError";
    this.code = code;
  }
}

export interface ImageGenerationService {
  generateImageMetadata(
    request: ProjectScopedPromptImageGenerationRequest,
    signal?: AbortSignal,
  ): Promise<PromptImageGenerationResponse>;
  generateVideoMetadata(
    request: PromptVideoGenerationRequest,
    signal?: AbortSignal,
  ): Promise<PromptImageGenerationResponse>;
}

export type ProjectScopedPromptImageGenerationRequest =
  PromptImageGenerationRequest & {
    projectId: string;
  };

export type ProjectScopedImageHistoryEntry = PromptImageGenerationHistoryEntry & {
  previewPath?: string;
  projectId: string;
};

export type ProjectImageHistoryResult =
  | {
      kind: "history";
      status: "authenticated";
      entries: ProjectScopedImageHistoryEntry[];
      message: string;
      projectId: string;
    }
  | {
      kind: "unavailable";
      status: string;
      message: string;
    };

export const imageGenerationService: ImageGenerationService = {
  async generateImageMetadata(request, signal) {
    return submitGenerationJob(request, signal);
  },
  async generateVideoMetadata(request, signal) {
    return submitGenerationJob(request, signal);
  },
};

const submitGenerationJob = async (
  request: PromptGenerationRequest | ProjectScopedPromptImageGenerationRequest,
  signal?: AbortSignal,
): Promise<PromptImageGenerationResponse> => {
    const response = await fetchWithOptionalAccountBearer("/generation/jobs", {
      body: JSON.stringify({
        generationKind: request.generationKind,
        prompt: request.prompt,
        providerId: request.providerId,
        ...("projectId" in request ? { projectId: request.projectId } : {}),
        requestId: request.requestId,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
      signal,
    });

    const body = (await readJson(response)) as PromptImageGenerationResponse;

    if (!response.ok && !isRejectedGenerationResponse(body)) {
      throw new ImageGenerationServiceError(
        `Image generation request failed with status ${response.status}.`,
        "http_error",
      );
    }

    if (
      !isMetadataReadyGenerationResponse(body) &&
      !isRejectedGenerationResponse(body)
    ) {
      throw new ImageGenerationServiceError(
        "Image generation response payload is invalid.",
        "invalid_response_payload",
      );
    }

    return body;
};

export const getProjectImageGenerationHistory = async (
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectImageHistoryResult> => {
  const response = await fetchWithOptionalAccountBearer(
    `/generation/history?projectId=${encodeURIComponent(projectId)}`,
    {
      credentials: "same-origin",
      method: "GET",
      signal,
    },
  );
  const body = await readJson(response);

  if (isProjectImageHistoryResponse(body)) {
    return {
      kind: "history",
      status: "authenticated",
      entries: body.history.map((entry) => ({
        contentType: entry.contentType,
        createdAt: entry.createdAt,
        deliveryStatus: entry.deliveryStatus,
        generationId: entry.generationId,
        previewPath: entry.previewPath,
        projectId: entry.projectId,
        prompt: entry.promptSummary ?? "Prompt summary unavailable",
        providerId: entry.providerId,
        requestId: entry.requestId,
        sha256: entry.sha256,
        sizeBytes: entry.sizeBytes,
        status: "metadata_ready",
      })),
      message: body.message,
      projectId: body.projectId,
    };
  }

  if (isRecord(body) && typeof body.message === "string") {
    return {
      kind: "unavailable",
      status: typeof body.status === "string" ? body.status : "unavailable",
      message: body.message,
    };
  }

  return {
    kind: "unavailable",
    status: "unavailable",
    message: `Generated image history request failed with status ${response.status}.`,
  };
};

export const fetchGeneratedImagePreviewBlob = async (
  previewPath: string,
  signal?: AbortSignal,
): Promise<Blob> => {
  const previewUrl = new URL(previewPath, "https://free-ai-mixer.local");

  if (
    !/^\/generation\/jobs\/[A-Za-z0-9_-]{1,120}\/artifacts\/[A-Za-z0-9_-]{1,120}\/preview$/.test(
      previewUrl.pathname,
    )
  ) {
    throw new ImageGenerationServiceError(
      "Generated image preview path is invalid.",
      "invalid_preview_path",
    );
  }

  const response = await fetchWithOptionalAccountBearer(previewPath, {
    credentials: "same-origin",
    method: "GET",
    signal,
  });

  if (!response.ok) {
    throw new ImageGenerationServiceError(
      "Generated image preview is unavailable.",
      "preview_unavailable",
    );
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (
    contentType !== "image/png" &&
    contentType !== "image/jpeg" &&
    contentType !== "image/webp"
  ) {
    throw new ImageGenerationServiceError(
      "Generated image preview content type is unsupported.",
      "unsupported_preview_content_type",
    );
  }

  return response.blob();
};

const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isProjectImageHistoryResponse = (
  value: unknown,
): value is {
  kind: "generation_history";
  status: "authenticated";
  message: string;
  projectId: string;
  history: Array<{
    artifactId: string;
    contentType: "image/png" | "image/jpeg" | "image/webp";
    createdAt: string;
    deliveryStatus: "unavailable";
    generationId: string;
    previewPath: string;
    projectId: string;
    promptSummary?: string;
    providerId: "mock_local" | "openai";
    requestId: string;
    sha256: string;
    sizeBytes: number;
  }>;
} =>
  isRecord(value) &&
  value.kind === "generation_history" &&
  value.status === "authenticated" &&
  typeof value.projectId === "string" &&
  typeof value.message === "string" &&
  Array.isArray(value.history);

const isMetadataReadyGenerationResponse = (
  value: unknown,
): value is Extract<
  PromptImageGenerationResponse,
  { kind: "generation_job_metadata_ready" }
> => {
  if (!isRecord(value) || value.kind !== "generation_job_metadata_ready") {
    return false;
  }

  const artifact = value.artifact;

  return (
    isRecord(artifact) &&
    value.status === "generated_metadata_ready" &&
    typeof artifact.artifactId === "string" &&
    typeof artifact.providerId === "string" &&
    typeof artifact.contentType === "string" &&
    typeof artifact.sizeBytes === "number" &&
    typeof artifact.createdAt === "string" &&
    artifact.deliveryStatus === "unavailable"
  );
};

const isRejectedGenerationResponse = (
  value: unknown,
): value is Extract<
  PromptImageGenerationResponse,
  { kind: "generation_job_rejected" }
> =>
  isRecord(value) &&
  value.kind === "generation_job_rejected" &&
  typeof value.status === "string" &&
  typeof value.message === "string";
