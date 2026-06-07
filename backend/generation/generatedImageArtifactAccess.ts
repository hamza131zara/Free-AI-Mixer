import type { GeneratedImageArtifactRegistry } from "./generatedImageArtifactRegistry";

export type GeneratedImageArtifactAccessStatus =
  | "access_not_configured"
  | "descriptor_not_enabled"
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

export const createRegistryBackedGeneratedImageArtifactAccessResolver = ({
  registry,
}: {
  registry: GeneratedImageArtifactRegistry;
}): GeneratedImageArtifactAccessResolver => ({
  async resolveAccess({ artifactId, jobId, requester }) {
    const record = registry.get({ artifactId, jobId });

    if (
      !record ||
      record.artifact.ownerId !== requester.userId ||
      record.artifact.workspaceId !== requester.workspaceId
    ) {
      return {
        kind: "generated_artifact_access_unavailable",
        status: "generated_artifact_access_unavailable",
        deliveryStatus: "unavailable",
        message: "Generated image artifact access is unavailable.",
      };
    }

    return {
      kind: "generated_artifact_access_unavailable",
      status: "descriptor_not_enabled",
      deliveryStatus: "unavailable",
      message:
        "Generated image artifact metadata is registered, but preview delivery is not enabled.",
    };
  },
});
