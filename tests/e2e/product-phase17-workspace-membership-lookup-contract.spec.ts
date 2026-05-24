import { expect, test } from "@playwright/test";
import { resolveWorkspaceMembershipLookupReadiness } from "../../backend/auth/workspaceMembershipLookup";

test.describe("product phase 17 workspace membership lookup contract", () => {
  test("workspace membership lookup remains planned and fail-closed", () => {
    expect(resolveWorkspaceMembershipLookupReadiness()).toEqual({
      kind: "workspace_membership_lookup_not_enabled",
      sourceTables: ["app_users", "workspaces", "workspace_memberships"],
      canonicalRoles: [
        "workspace_owner",
        "workspace_admin",
        "workspace_member",
        "workspace_viewer",
      ],
      supabaseUserMapping: "planned_via_app_users",
      activeWorkspaceSource: "backend_derived_only",
      liveLookupEnabled: false,
      automaticWorkspaceCreationEnabled: false,
      workspaceMutationEnabled: false,
      missingMembershipFailsClosed: true,
      inactiveMembershipFailsClosed: true,
    });
  });
});
