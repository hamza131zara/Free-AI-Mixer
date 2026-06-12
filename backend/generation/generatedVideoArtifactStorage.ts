import type { GeneratedVideoArtifactContentType } from "./generatedVideoArtifactVerification";

export type GeneratedVideoArtifactDeliveryStatus = "unavailable";

export interface GeneratedVideoArtifactSafeMetadata {
  artifactId: string;
  contentType: GeneratedVideoArtifactContentType;
  createdAt: string;
  deliveryStatus: GeneratedVideoArtifactDeliveryStatus;
  generationKind: "video";
  providerId: "veo" | "runway" | "pika" | "gemini_video" | "mock_local";
  sha256: string;
  sizeBytes: number;
  status: "metadata_only";
}

export interface StoreGeneratedVideoArtifactInput {
  artifactId: string;
  bytes: Uint8Array;
  contentType: GeneratedVideoArtifactContentType;
  jobId: string;
  providerId: GeneratedVideoArtifactSafeMetadata["providerId"];
  sha256: string;
  sizeBytes: number;
  workspaceId: string;
}

export type StoreGeneratedVideoArtifactResult =
  | {
      kind: "stored";
      artifact: GeneratedVideoArtifactSafeMetadata;
    }
  | {
      kind: "failed";
      status: "video_artifact_storage_unavailable";
      message: string;
    };

export type GeneratedVideoArtifactStorageReadiness =
  | {
      kind: "ready";
    }
  | {
      kind: "not_configured";
      message: string;
    };

export interface GeneratedVideoArtifactStorage {
  getReadiness(): GeneratedVideoArtifactStorageReadiness;
  storeVerifiedVideoArtifact(
    input: StoreGeneratedVideoArtifactInput,
  ): Promise<StoreGeneratedVideoArtifactResult>;
}

export const createNotConfiguredGeneratedVideoArtifactStorage =
  (): GeneratedVideoArtifactStorage => ({
    getReadiness: () => ({
      kind: "not_configured",
      message:
        "Generated video artifact storage is not configured; playback and metadata-ready video results remain unavailable.",
    }),
    storeVerifiedVideoArtifact: async () => ({
      kind: "failed",
      message:
        "Generated video artifact storage is not configured; video artifacts cannot be stored.",
      status: "video_artifact_storage_unavailable",
    }),
  });
