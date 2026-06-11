import type { GeneratedImageArtifactRegistry } from "./generatedImageArtifactRegistry";
import type { GeneratedImageProductionStorage } from "./supabaseGeneratedImageProductionStorage";

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
  | GeneratedImageArtifactAccessUnavailableResult
  | {
      kind: "generated_artifact_access_descriptor";
      status: "descriptor_ready";
      deliveryStatus: "backend_mediated_preview_available";
      previewPath: string;
      message: string;
    };

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

export const createProductionGeneratedImageArtifactAccessResolver = ({
  productionStorage,
}: {
  productionStorage: GeneratedImageProductionStorage;
}): GeneratedImageArtifactAccessResolver => ({
  async resolveAccess({ artifactId, jobId, requester }) {
    const record = await productionStorage.resolveRecord({
      artifactId,
      jobId,
      ownerId: requester.userId,
      workspaceId: requester.workspaceId,
    });

    if (record.kind !== "resolved") {
      return {
        kind: "generated_artifact_access_unavailable",
        status: "generated_artifact_access_unavailable",
        deliveryStatus: "unavailable",
        message: "Generated image artifact access is unavailable.",
      };
    }

    return {
      kind: "generated_artifact_access_descriptor",
      status: "descriptor_ready",
      deliveryStatus: "backend_mediated_preview_available",
      previewPath: `/generation/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(artifactId)}/preview`,
      message:
        "Generated image artifact preview is available through backend-mediated delivery.",
    };
  },
});
