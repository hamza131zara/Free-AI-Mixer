import type {
  WorkspaceMembershipRecord,
  WorkspaceMembershipRepository,
} from "./workspaceMembership";

const createMembershipKey = (userId: string, workspaceId: string): string =>
  `${userId}::${workspaceId}`;

export interface InMemoryWorkspaceMembershipRepositoryOptions {
  memberships?: WorkspaceMembershipRecord[];
}

/**
 * Phase 138 repository boundary.
 *
 * This is an offline/local repository implementation only.
 * It intentionally does not query Supabase, apply RLS, trust headers,
 * enforce routes, authenticate users, or enable artifact delivery.
 */
export const createInMemoryWorkspaceMembershipRepository = (
  options: InMemoryWorkspaceMembershipRepositoryOptions = {},
): WorkspaceMembershipRepository => {
  const membershipByKey = new Map<string, WorkspaceMembershipRecord>();

  for (const membership of options.memberships ?? []) {
    membershipByKey.set(
      createMembershipKey(membership.userId, membership.workspaceId),
      membership,
    );
  }

  return {
    getMembership: async ({ userId, workspaceId }) => {
      const membership = membershipByKey.get(
        createMembershipKey(userId, workspaceId),
      );

      if (!membership) {
        return {
          kind: "not_member",
          reason: "not_found",
        };
      }

      return {
        kind: "member",
        membership,
      };
    },
  };
};
