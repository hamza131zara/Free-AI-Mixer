export type ArtifactDeliveryReadyUnavailableReason =
  | "authorization_required"
  | "workspace_or_rls_not_ready"
  | "artifact_metadata_missing"
  | "artifact_id_mismatch"
  | "artifact_not_ready"
  | "artifact_expired"
  | "unsafe_artifact_metadata"
  | "storage_ref_missing"
  | "invalid_storage_ref"
  | "storage_not_configured"
  | "provider_unavailable"
  | "signed_url_not_configured";

export interface ArtifactDeliveryReadyPreconditionsInput {
  authorization: {
    ownerOrWorkspaceAccessAllowed: boolean;
    workspaceMembershipOrRlsReady: boolean;
  };
  artifact: {
    metadataExists: boolean;
    artifactIdMatches: boolean;
    status: "available" | "ready" | "pending" | "failed" | "expired" | "unknown";
    safeMetadataOnly: boolean;
  };
  storage: {
    storageRefExists?: boolean;
    storageRefValid?: boolean;
    providerConfigured: boolean;
    providerCanResolve: boolean;
  };
  signedDelivery?: {
    providerConfigured: boolean;
  };
}

export type ArtifactDeliveryReadyPreconditionsDecision =
  | {
      kind: "unavailable";
      reason: ArtifactDeliveryReadyUnavailableReason;
    }
  | {
      kind: "ready";
      deliveryMode: "backend_signed_url";
    };

/**
 * Phase 157/7 pure backend precondition boundary.
 *
 * This helper decides whether an artifact delivery descriptor is allowed to
 * become ready for backend-issued signed delivery.
 *
 * It intentionally does not:
 * - read route requests
 * - trust headers
 * - query storage directly
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

  if (input.artifact.status === "expired") {
    return {
      kind: "unavailable",
      reason: "artifact_expired",
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

  if (input.storage.storageRefExists === false) {
    return {
      kind: "unavailable",
      reason: "storage_ref_missing",
    };
  }

  if (input.storage.storageRefValid === false) {
    return {
      kind: "unavailable",
      reason: "invalid_storage_ref",
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

  if (input.signedDelivery && !input.signedDelivery.providerConfigured) {
    return {
      kind: "unavailable",
      reason: "signed_url_not_configured",
    };
  }

  return {
    kind: "ready",
    deliveryMode: "backend_signed_url",
  };
};
