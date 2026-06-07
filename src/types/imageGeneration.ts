export type PromptImageGenerationLifecycle =
  | "idle"
  | "submitting"
  | "metadata_ready"
  | "failed";

export type PromptImageProviderId = "openai";
export type PromptImageArtifactProviderId = PromptImageProviderId | "mock_local";

export interface PromptImageGenerationRequest {
  providerId: PromptImageProviderId;
  generationKind: "image";
  prompt: string;
  requestId: string;
}

export interface PromptImageArtifactMetadata {
  artifactId: string;
  providerId: PromptImageArtifactProviderId;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  sizeBytes: number;
  sha256?: string;
  createdAt: string;
  deliveryStatus: "unavailable";
}

export interface PromptImageGenerationMetadataReadyResponse {
  kind: "generation_job_metadata_ready";
  status: "generated_metadata_ready";
  message: string;
  artifact: PromptImageArtifactMetadata;
  runtime: {
    vendorCallsEnabled: boolean;
  };
  attemptedProviderIds: PromptImageArtifactProviderId[];
}

export interface PromptImageGenerationRejectedResponse {
  kind: "generation_job_rejected";
  status: string;
  message: string;
  runtime?: {
    vendorCallsEnabled?: boolean;
  };
  attemptedProviderIds?: PromptImageArtifactProviderId[];
  diagnosticCode?: string;
  failureCategory?: string;
}

export type PromptImageGenerationResponse =
  | PromptImageGenerationMetadataReadyResponse
  | PromptImageGenerationRejectedResponse;

export interface PromptImageGenerationError {
  message: string;
  code?: string;
}

export interface PromptImageGenerationHistoryEntry {
  generationId: string;
  requestId: string;
  prompt: string;
  providerId: PromptImageArtifactProviderId;
  contentType: PromptImageArtifactMetadata["contentType"];
  sizeBytes: number;
  createdAt: string;
  deliveryStatus: "unavailable";
  sha256?: string;
  status: "metadata_ready";
}
