export interface BackendMediatedArtifactDeliveryRequest {
  jobId: string;
  artifactId: string;
  requester: {
    userId: string;
    workspaceId: string;
  };
  authorization: {
    ownerOrWorkspaceAccessAllowed: boolean;
    workspaceMembershipOrRlsReady: boolean;
  };
  storage: {
    artifactReady: boolean;
    providerConfigured: boolean;
  };
}

export type BackendMediatedArtifactDeliveryResult =
  | {
      kind: "unavailable";
      reason:
        | "authorization_required"
        | "workspace_or_rls_not_ready"
        | "storage_not_configured"
        | "artifact_not_ready";
    }
  | {
      kind: "ready";
      deliveryMode: "backend_mediated";
      jobId: string;
      artifactId: string;
      backendRoutePath: string;
      expiresAt: string;
    };

export const resolveBackendMediatedArtifactDelivery = (
  request: BackendMediatedArtifactDeliveryRequest,
  now: Date = new Date(),
): BackendMediatedArtifactDeliveryResult => {
  if (!request.authorization.ownerOrWorkspaceAccessAllowed) {
    return {
      kind: "unavailable",
      reason: "authorization_required",
    };
  }

  if (!request.authorization.workspaceMembershipOrRlsReady) {
    return {
      kind: "unavailable",
      reason: "workspace_or_rls_not_ready",
    };
  }

  if (!request.storage.providerConfigured) {
    return {
      kind: "unavailable",
      reason: "storage_not_configured",
    };
  }

  if (!request.storage.artifactReady) {
    return {
      kind: "unavailable",
      reason: "artifact_not_ready",
    };
  }

  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

  return {
    kind: "ready",
    deliveryMode: "backend_mediated",
    jobId: request.jobId,
    artifactId: request.artifactId,
    backendRoutePath: `/exports/${encodeURIComponent(request.jobId)}/artifacts/${encodeURIComponent(
      request.artifactId,
    )}/stream`,
    expiresAt,
  };
};

export const isBackendMediatedArtifactDeliveryReady = (
  result: BackendMediatedArtifactDeliveryResult,
): result is Extract<BackendMediatedArtifactDeliveryResult, { kind: "ready" }> =>
  result.kind === "ready";
