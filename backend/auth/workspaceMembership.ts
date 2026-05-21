export type WorkspaceMembershipRole = "owner" | "admin" | "member" | "viewer";

export type WorkspaceMembershipStatus = "active" | "disabled";

export interface WorkspaceMembershipRecord {
  userId: string;
  workspaceId: string;
  role: WorkspaceMembershipRole;
  status: WorkspaceMembershipStatus;
  source: "workspace_memberships";
}

export interface WorkspaceMembershipLookupInput {
  userId: string;
  workspaceId: string;
}

export type WorkspaceMembershipLookupResult =
  | {
      kind: "member";
      membership: WorkspaceMembershipRecord;
    }
  | {
      kind: "not_member";
      reason: "not_configured" | "not_found" | "inactive";
    };

export type WorkspaceMembershipAccessDecision =
  | {
      kind: "allowed";
      userId: string;
      workspaceId: string;
      role: WorkspaceMembershipRole;
    }
  | {
      kind: "denied";
      reason: "membership_not_configured" | "membership_not_found" | "membership_inactive";
    };

export interface WorkspaceMembershipRepository {
  getMembership(
    input: WorkspaceMembershipLookupInput,
  ): Promise<WorkspaceMembershipLookupResult>;
}

/**
 * Phase 137 contract boundary.
 *
 * This is intentionally a pure membership boundary only.
 * It does not query Supabase, apply RLS, trust headers, enforce routes,
 * authenticate users, or enable artifact delivery.
 */
export const createWorkspaceMembershipNotConfiguredRepository =
  (): WorkspaceMembershipRepository => ({
    getMembership: async () => ({
      kind: "not_member",
      reason: "not_configured",
    }),
  });

export const decideWorkspaceMembershipAccess = (
  result: WorkspaceMembershipLookupResult,
): WorkspaceMembershipAccessDecision => {
  if (result.kind === "not_member") {
    if (result.reason === "not_configured") {
      return {
        kind: "denied",
        reason: "membership_not_configured",
      };
    }

    if (result.reason === "inactive") {
      return {
        kind: "denied",
        reason: "membership_inactive",
      };
    }

    return {
      kind: "denied",
      reason: "membership_not_found",
    };
  }

  if (result.membership.status !== "active") {
    return {
      kind: "denied",
      reason: "membership_inactive",
    };
  }

  return {
    kind: "allowed",
    userId: result.membership.userId,
    workspaceId: result.membership.workspaceId,
    role: result.membership.role,
  };
};
