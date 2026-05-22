export type ArtifactDeliveryReadyUnavailableReason =
  | "authorization_required"
  | "workspace_or_rls_not_ready"
  | "artifact_metadata_missing"
  | "artifact_id_mismatch"
  | "artifact_not_ready"
  | "unsafe_artifact_metadata"
  | "storage_not_configured"
  | "provider_unavailable";

export interface ArtifactDeliveryReadyPreconditionsInput {
  authorization: {
    ownerOrWorkspaceAccessAllowed: boolean;
    workspaceMembershipOrRlsReady: boolean;
  };
  artifact: {
    metadataExists: boolean;
    artifactIdMatches: boolean;
    status: "available" | "ready" | "pending" | "failed" | "unknown";
    safeMetadataOnly: boolean;
  };
  storage: {
    providerConfigured: boolean;
    providerCanResolve: boolean;
  };
}

export type ArtifactDeliveryReadyPreconditionsDecision =
  | {
      kind: "unavailable";
      reason: ArtifactDeliveryReadyUnavailableReason;
    }
  | {
      kind: "ready";
      deliveryMode: "backend_mediated";
    };

/**
 * Phase 157 pure backend precondition boundary.
 *
 * This helper decides whether a backend-mediated artifact delivery descriptor
 * is allowed to become ready.
 *
 * It intentionally does not:
 * - read route requests
 * - trust headers
 * - query storage
 * - generate signed URLs
 * - generate public URLs
 * - expose local file paths
 * - use service-role secrets
 * - perform browser download/navigation
 */
export const decideArtifactDeliveryReadyPreconditions = (
  input: ArtifactDeliveryReadyPreconditionsInput,
): ArtifactDeliveryReadyPreconditionsDecision => {
  if (!input.authorization.ownerOrWorkspaceAccessAllowed) {
    return {
      kind: "unavailable",
      reason: "authorization_required",
    };
  }

  if (!input.authorization.workspaceMembershipOrRlsReady) {
    return {
      kind: "unavailable",
      reason: "workspace_or_rls_not_ready",
    };
  }

  if (!input.artifact.metadataExists) {
    return {
      kind: "unavailable",
      reason: "artifact_metadata_missing",
    };
  }

  if (!input.artifact.artifactIdMatches) {
    return {
      kind: "unavailable",
      reason: "artifact_id_mismatch",
    };
  }

  if (input.artifact.status !== "available" && input.artifact.status !== "ready") {
    return {
      kind: "unavailable",
      reason: "artifact_not_ready",
    };
  }

  if (!input.artifact.safeMetadataOnly) {
    return {
      kind: "unavailable",
      reason: "unsafe_artifact_metadata",
    };
  }

  if (!input.storage.providerConfigured) {
    return {
      kind: "unavailable",
      reason: "storage_not_configured",
    };
  }

  if (!input.storage.providerCanResolve) {
    return {
      kind: "unavailable",
      reason: "provider_unavailable",
    };
  }

  return {
    kind: "ready",
    deliveryMode: "backend_mediated",
  };
};
