import type { BackendRequesterContext } from "../auth/requesterContext";
import type { WorkspaceMembershipRepository } from "../auth/workspaceMembership";
import { decideWorkspaceMembershipEnforcement } from "../auth/workspaceMembershipEnforcement";
import type { BackendExportJobOwnerScope } from "../contracts/exportHttpTypes";

export type ArtifactDeliveryAuthorizationUnavailableReason =
  | "authorization_required"
  | "workspace_or_rls_not_ready";

export interface ArtifactDeliveryRuntimeAuthorizationInput {
  requesterContext: BackendRequesterContext;
  exportOwnerScope: BackendExportJobOwnerScope;
  authorizationMode: "disabled" | "enforce";
  workspaceMembershipRepository?: WorkspaceMembershipRepository;
}

export type ArtifactDeliveryRuntimeAuthorizationDecision =
  | {
      kind: "unavailable";
      reason: ArtifactDeliveryAuthorizationUnavailableReason;
      requesterVerified: false;
      ownerOrWorkspaceAccessAllowed: false;
      workspaceMembershipOrRlsReady: false;
    }
  | {
      kind: "unavailable";
      reason: ArtifactDeliveryAuthorizationUnavailableReason;
      requesterVerified: true;
      ownerOrWorkspaceAccessAllowed: boolean;
      workspaceMembershipOrRlsReady: false;
    }
  | {
      kind: "ready";
      requesterVerified: true;
      ownerOrWorkspaceAccessAllowed: true;
      workspaceMembershipOrRlsReady: true;
    };

export const resolveArtifactDeliveryRuntimeAuthorization = async ({
  requesterContext,
  exportOwnerScope,
  authorizationMode,
  workspaceMembershipRepository,
}: ArtifactDeliveryRuntimeAuthorizationInput): Promise<ArtifactDeliveryRuntimeAuthorizationDecision> => {
  if (authorizationMode !== "enforce") {
    return {
      kind: "unavailable",
      reason: "authorization_required",
      requesterVerified: false,
      ownerOrWorkspaceAccessAllowed: false,
      workspaceMembershipOrRlsReady: false,
    };
  }

  if (requesterContext.kind !== "authenticated") {
    return {
      kind: "unavailable",
      reason: "authorization_required",
      requesterVerified: false,
      ownerOrWorkspaceAccessAllowed: false,
      workspaceMembershipOrRlsReady: false,
    };
  }

  if (!requesterContext.workspaceId) {
    return {
      kind: "unavailable",
      reason: "workspace_or_rls_not_ready",
      requesterVerified: true,
      ownerOrWorkspaceAccessAllowed: false,
      workspaceMembershipOrRlsReady: false,
    };
  }

  if (
    requesterContext.userId === exportOwnerScope.ownerId &&
    requesterContext.workspaceId === exportOwnerScope.workspaceId
  ) {
    return {
      kind: "ready",
      requesterVerified: true,
      ownerOrWorkspaceAccessAllowed: true,
      workspaceMembershipOrRlsReady: true,
    };
  }

  if (!workspaceMembershipRepository) {
    return {
      kind: "unavailable",
      reason: "workspace_or_rls_not_ready",
      requesterVerified: true,
      ownerOrWorkspaceAccessAllowed: false,
      workspaceMembershipOrRlsReady: false,
    };
  }

  const workspaceDecision = await decideWorkspaceMembershipEnforcement({
    requesterContext,
    exportScope: exportOwnerScope,
    membershipRepository: workspaceMembershipRepository,
  });

  if (workspaceDecision.kind !== "allowed") {
    return {
      kind: "unavailable",
      reason: workspaceDecision.reason === "unauthenticated"
        ? "authorization_required"
        : "workspace_or_rls_not_ready",
      requesterVerified: true,
      ownerOrWorkspaceAccessAllowed: false,
      workspaceMembershipOrRlsReady: false,
    };
  }

  return {
    kind: "ready",
    requesterVerified: true,
    ownerOrWorkspaceAccessAllowed: true,
    workspaceMembershipOrRlsReady: true,
  };
};
