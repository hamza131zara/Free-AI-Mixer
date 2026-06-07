export type PromptImageGenerationLifecycle =
  | "idle"
  | "submitting"
  | "metadata_ready"
  | "failed";

export type PromptVideoGenerationLifecycle =
  | "idle"
  | "submitting"
  | "processing"
  | "metadata_ready"
  | "failed";

export type PromptImageProviderId = "openai";
export type PromptVideoProviderId = "mock_local";
export type PromptGenerationArtifactProviderId =
  | PromptImageProviderId
  | PromptVideoProviderId;
export type PromptImageArtifactProviderId = PromptGenerationArtifactProviderId;

export interface PromptImageGenerationRequest {
  providerId: PromptImageProviderId;
  generationKind: "image";
  prompt: string;
  requestId: string;
}

export interface PromptVideoGenerationRequest {
  providerId: PromptVideoProviderId;
  generationKind: "video";
  prompt: string;
  requestId: string;
}

export type PromptGenerationRequest =
  | PromptImageGenerationRequest
  | PromptVideoGenerationRequest;

export interface PromptImageArtifactMetadata {
  artifactId: string;
  providerId: PromptImageArtifactProviderId;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  sizeBytes: number;
  sha256?: string;
  createdAt: string;
  deliveryStatus: "unavailable";
  previewPath?: string;
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
  attemptedProviderIds?: PromptGenerationArtifactProviderId[];
  generationKind?: "image" | "video";
  lifecycle?: "submitted" | "processing" | "metadata_ready" | "failed";
  lifecycleTrace?: Array<"submitted" | "processing" | "metadata_ready" | "failed">;
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
