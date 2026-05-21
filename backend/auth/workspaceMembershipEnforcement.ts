import type { BackendRequesterContext } from "./requesterContext";
import type {
  WorkspaceMembershipRepository,
  WorkspaceMembershipRole,
} from "./workspaceMembership";
import { decideWorkspaceMembershipAccess } from "./workspaceMembership";

export interface WorkspaceMembershipEnforcementExportScope {
  ownerId: string;
  workspaceId: string;
}

export type WorkspaceMembershipEnforcementDecision =
  | {
      kind: "allowed";
      reason: "owner_match" | "workspace_member";
      userId: string;
      workspaceId: string;
      role?: WorkspaceMembershipRole;
    }
  | {
      kind: "denied";
      reason:
        | "unauthenticated"
        | "owner_mismatch"
        | "workspace_mismatch"
        | "membership_not_configured"
        | "membership_not_found"
        | "membership_inactive";
    };

export interface DecideWorkspaceMembershipEnforcementInput {
  requesterContext: BackendRequesterContext;
  exportScope: WorkspaceMembershipEnforcementExportScope;
  membershipRepository: WorkspaceMembershipRepository;
}

/**
 * Phase 139 backend-only enforcement boundary.
 *
 * This helper composes trusted authenticated requester context, export
 * owner/workspace scope, and the workspace membership repository boundary.
 *
 * It intentionally does not wire routes, trust headers, apply RLS, query
 * Supabase directly, create fake sessions, or enable public artifact delivery.
 */
export const decideWorkspaceMembershipEnforcement = async ({
  requesterContext,
  exportScope,
  membershipRepository,
}: DecideWorkspaceMembershipEnforcementInput): Promise<WorkspaceMembershipEnforcementDecision> => {
  if (requesterContext.kind !== "authenticated") {
    return {
      kind: "denied",
      reason: "unauthenticated",
    };
  }

  if (requesterContext.userId === exportScope.ownerId) {
    if (requesterContext.workspaceId !== exportScope.workspaceId) {
      return {
        kind: "denied",
        reason: "workspace_mismatch",
      };
    }

    return {
      kind: "allowed",
      reason: "owner_match",
      userId: requesterContext.userId,
      workspaceId: requesterContext.workspaceId,
    };
  }

  if (requesterContext.workspaceId !== exportScope.workspaceId) {
    return {
      kind: "denied",
      reason: "workspace_mismatch",
    };
  }

  const membershipResult = await membershipRepository.getMembership({
    userId: requesterContext.userId,
    workspaceId: exportScope.workspaceId,
  });

  const membershipDecision = decideWorkspaceMembershipAccess(membershipResult);

  if (membershipDecision.kind === "denied") {
    return {
      kind: "denied",
      reason: membershipDecision.reason,
    };
  }

  return {
    kind: "allowed",
    reason: "workspace_member",
    userId: membershipDecision.userId,
    workspaceId: membershipDecision.workspaceId,
    role: membershipDecision.role,
  };
};
