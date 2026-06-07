export type GeneratedImageArtifactAccessStatus =
  | "access_not_configured"
  | "generated_artifact_access_unavailable"
  | "invalid_artifact_identity"
  | "unauthenticated";

export interface GeneratedImageArtifactAccessRequest {
  artifactId: string;
  jobId: string;
  requester: {
    userId: string;
    workspaceId: string;
  };
}

export interface GeneratedImageArtifactAccessUnavailableResult {
  kind: "generated_artifact_access_unavailable";
  status: GeneratedImageArtifactAccessStatus;
  deliveryStatus: "unavailable";
  message: string;
}

export type GeneratedImageArtifactAccessResult =
  GeneratedImageArtifactAccessUnavailableResult;

export interface GeneratedImageArtifactAccessResolver {
  resolveAccess(
    request: GeneratedImageArtifactAccessRequest,
  ): Promise<GeneratedImageArtifactAccessResult>;
}

export const createNotConfiguredGeneratedImageArtifactAccessResolver =
  (): GeneratedImageArtifactAccessResolver => ({
    async resolveAccess() {
      return {
        kind: "generated_artifact_access_unavailable",
        status: "access_not_configured",
        deliveryStatus: "unavailable",
        message:
          "Generated image artifact preview access is not configured.",
      };
    },
  });
