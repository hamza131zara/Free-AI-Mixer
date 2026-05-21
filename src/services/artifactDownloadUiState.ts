export type ArtifactDownloadDescriptor =
  | {
      kind: "unavailable";
      reason:
        | "authorization_required"
        | "workspace_or_rls_not_ready"
        | "storage_not_configured"
        | "artifact_not_ready"
        | "not_configured";
    }
  | {
      kind: "ready";
      deliveryMode: "backend_mediated";
      jobId: string;
      artifactId: string;
      backendRoutePath: string;
      expiresAt: string;
    };

export type ArtifactDownloadUiState =
  | {
      kind: "disabled";
      label: "Download unavailable";
      reason:
        | "no_descriptor"
        | "authorization_required"
        | "workspace_or_rls_not_ready"
        | "storage_not_configured"
        | "artifact_not_ready"
        | "not_configured";
    }
  | {
      kind: "ready";
      label: "Download artifact";
      descriptor: Extract<ArtifactDownloadDescriptor, { kind: "ready" }>;
    };

export const getArtifactDownloadUiState = (
  descriptor?: ArtifactDownloadDescriptor,
): ArtifactDownloadUiState => {
  if (!descriptor) {
    return {
      kind: "disabled",
      label: "Download unavailable",
      reason: "no_descriptor",
    };
  }

  if (descriptor.kind === "unavailable") {
    return {
      kind: "disabled",
      label: "Download unavailable",
      reason: descriptor.reason,
    };
  }

  return {
    kind: "ready",
    label: "Download artifact",
    descriptor,
  };
};
