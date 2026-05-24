export const canonicalWorkspaceRoles = [
  "workspace_owner",
  "workspace_admin",
  "workspace_member",
  "workspace_viewer",
] as const;

export type CanonicalWorkspaceRole = (typeof canonicalWorkspaceRoles)[number];

export interface WorkspaceMembershipLookupReadinessDecision {
  kind: "workspace_membership_lookup_not_enabled";
  sourceTables: ["app_users", "workspaces", "workspace_memberships"];
  canonicalRoles: readonly CanonicalWorkspaceRole[];
  supabaseUserMapping: "planned_via_app_users";
  activeWorkspaceSource: "backend_derived_only";
  liveLookupEnabled: false;
  automaticWorkspaceCreationEnabled: false;
  workspaceMutationEnabled: false;
  missingMembershipFailsClosed: true;
  inactiveMembershipFailsClosed: true;
}

/**
 * Phase 17 workspace membership lookup contract.
 *
 * This defines the future mapping from a verified Supabase user to app-level
 * workspace memberships without performing any database lookup or mutation.
 */
export const resolveWorkspaceMembershipLookupReadiness =
  (): WorkspaceMembershipLookupReadinessDecision => ({
    kind: "workspace_membership_lookup_not_enabled",
    sourceTables: ["app_users", "workspaces", "workspace_memberships"],
    canonicalRoles: canonicalWorkspaceRoles,
    supabaseUserMapping: "planned_via_app_users",
    activeWorkspaceSource: "backend_derived_only",
    liveLookupEnabled: false,
    automaticWorkspaceCreationEnabled: false,
    workspaceMutationEnabled: false,
    missingMembershipFailsClosed: true,
    inactiveMembershipFailsClosed: true,
  });
