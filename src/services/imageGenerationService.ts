import { fetchWithOptionalAccountBearer } from "./auth/authenticatedFetch";
import type {
  PromptImageGenerationRequest,
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
    request: PromptImageGenerationRequest,
    signal?: AbortSignal,
  ): Promise<PromptImageGenerationResponse>;
}

export const imageGenerationService: ImageGenerationService = {
  async generateImageMetadata(request, signal) {
    const response = await fetchWithOptionalAccountBearer("/generation/jobs", {
      body: JSON.stringify({
        generationKind: request.generationKind,
        prompt: request.prompt,
        providerId: request.providerId,
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
  },
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
