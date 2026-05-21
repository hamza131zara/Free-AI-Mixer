import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createWorkspaceMembershipNotConfiguredRepository,
  decideWorkspaceMembershipAccess,
  type WorkspaceMembershipLookupResult,
} from "../../backend/auth/workspaceMembership";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase137 workspace membership strategy contract pack", () => {
  test("workspace membership contract denies safely when repository is not configured", async () => {
    const repository = createWorkspaceMembershipNotConfiguredRepository();

    const result = await repository.getMembership({
      userId: "user-phase137",
      workspaceId: "workspace-phase137",
    });

    expect(result).toEqual({
      kind: "not_member",
      reason: "not_configured",
    });

    expect(decideWorkspaceMembershipAccess(result)).toEqual({
      kind: "denied",
      reason: "membership_not_configured",
    });
  });

  test("workspace membership decision allows active members and denies inactive or missing membership", async () => {
    const activeMembership: WorkspaceMembershipLookupResult = {
      kind: "member",
      membership: {
        userId: "user-phase137",
        workspaceId: "workspace-phase137",
        role: "member",
        status: "active",
        source: "workspace_memberships",
      },
    };

    expect(decideWorkspaceMembershipAccess(activeMembership)).toEqual({
      kind: "allowed",
      userId: "user-phase137",
      workspaceId: "workspace-phase137",
      role: "member",
    });

    const inactiveMembership: WorkspaceMembershipLookupResult = {
      kind: "member",
      membership: {
        userId: "user-phase137",
        workspaceId: "workspace-phase137",
        role: "member",
        status: "disabled",
        source: "workspace_memberships",
      },
    };

    expect(decideWorkspaceMembershipAccess(inactiveMembership)).toEqual({
      kind: "denied",
      reason: "membership_inactive",
    });

    expect(
      decideWorkspaceMembershipAccess({
        kind: "not_member",
        reason: "not_found",
      }),
    ).toEqual({
      kind: "denied",
      reason: "membership_not_found",
    });
  });

  test("workspace membership boundary is not wired into routes rls frontend storage or artifact delivery", async () => {
    const membershipSource = readSource("backend/auth/workspaceMembership.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const authorizationSource = readSource("backend/auth/exportAuthorization.ts");
    const appSource = readSource("backend/app.ts");

    expect(membershipSource).toContain("WorkspaceMembershipRepository");
    expect(membershipSource).toContain("createWorkspaceMembershipNotConfiguredRepository");
    expect(membershipSource).toContain("decideWorkspaceMembershipAccess");
    expect(membershipSource).toContain("membership_not_configured");

    // Phase 137 is contract-only. No runtime enforcement wiring yet.
    expect(routeSource).not.toContain("WorkspaceMembershipRepository");
    expect(routeSource).not.toContain("decideWorkspaceMembershipAccess");
    expect(routeSource).not.toContain("createWorkspaceMembershipNotConfiguredRepository");
    expect(authorizationSource).not.toContain("WorkspaceMembershipRepository");
    expect(authorizationSource).not.toContain("decideWorkspaceMembershipAccess");
    expect(appSource).not.toContain("WorkspaceMembershipRepository");
    expect(appSource).not.toContain("decideWorkspaceMembershipAccess");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("applyRls");
    expect(routeSource).not.toContain("createSignedUrl");
    expect(routeSource).not.toContain("getPublicUrl");

    const frontendSource =
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/types/exportJob.ts") +
      "\n" +
      readIfExists("src/services/exportHandleStorage.ts");

    const artifactSource =
      readIfExists("backend/artifacts/artifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/localDevArtifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/notConfiguredArtifactAccessProvider.ts");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");

    expect(artifactSource).not.toContain("production_ready_local_dev_stream");
    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("getPublicUrl");
  });
});
