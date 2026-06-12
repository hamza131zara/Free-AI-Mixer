export type GeneratedVideoArtifactContentType = "video/mp4" | "video/webm";

export type GeneratedVideoArtifactVerificationFailureCode =
  | "video_artifact_verification_unavailable"
  | "video_artifact_invalid_content_type"
  | "video_artifact_invalid_bytes"
  | "video_artifact_oversized";

export interface GeneratedVideoArtifactVerificationInput {
  bytes?: Uint8Array;
  contentType: GeneratedVideoArtifactContentType;
  maxBytes: number;
}

export interface VerifiedGeneratedVideoArtifactMetadata {
  contentType: GeneratedVideoArtifactContentType;
  sha256: string;
  sizeBytes: number;
}

export type GeneratedVideoArtifactVerificationResult =
  | {
      kind: "verified";
      video: VerifiedGeneratedVideoArtifactMetadata;
    }
  | {
      kind: "failed";
      code: GeneratedVideoArtifactVerificationFailureCode;
      message: string;
    };

export const generatedVideoArtifactContentTypes: readonly GeneratedVideoArtifactContentType[] =
  ["video/mp4", "video/webm"] as const;

export const isGeneratedVideoArtifactContentType = (
  value: string,
): value is GeneratedVideoArtifactContentType =>
  value === "video/mp4" || value === "video/webm";

export const verifyGeneratedVideoArtifactBytes = (
  input: GeneratedVideoArtifactVerificationInput,
): GeneratedVideoArtifactVerificationResult => {
  if (!isGeneratedVideoArtifactContentType(input.contentType)) {
    return {
      kind: "failed",
      code: "video_artifact_invalid_content_type",
      message: "Generated video content type is not supported.",
    };
  }

  return {
    kind: "failed",
    code: "video_artifact_verification_unavailable",
    message:
      "Generated video artifact verification is not available yet; video metadata cannot be marked ready.",
  };
};
