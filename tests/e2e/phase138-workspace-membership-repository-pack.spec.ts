import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createWorkspaceMembershipNotConfiguredRepository,
  decideWorkspaceMembershipAccess,
} from "../../backend/auth/workspaceMembership";
import { createInMemoryWorkspaceMembershipRepository } from "../../backend/auth/workspaceMembershipRepository";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase138 workspace membership repository pack", () => {
  test("in-memory workspace membership repository returns active membership records", async () => {
    const repository = createInMemoryWorkspaceMembershipRepository({
      memberships: [
        {
          userId: "user-phase138",
          workspaceId: "workspace-phase138",
          role: "admin",
          status: "active",
          source: "workspace_memberships",
        },
      ],
    });

    const result = await repository.getMembership({
      userId: "user-phase138",
      workspaceId: "workspace-phase138",
    });

    expect(result).toEqual({
      kind: "member",
      membership: {
        userId: "user-phase138",
        workspaceId: "workspace-phase138",
        role: "admin",
        status: "active",
        source: "workspace_memberships",
      },
    });

    expect(decideWorkspaceMembershipAccess(result)).toEqual({
      kind: "allowed",
      userId: "user-phase138",
      workspaceId: "workspace-phase138",
      role: "admin",
    });
  });

  test("repository denies missing and disabled memberships safely", async () => {
    const repository = createInMemoryWorkspaceMembershipRepository({
      memberships: [
        {
          userId: "disabled-user-phase138",
          workspaceId: "workspace-phase138",
          role: "member",
          status: "disabled",
          source: "workspace_memberships",
        },
      ],
    });

    const missing = await repository.getMembership({
      userId: "missing-user-phase138",
      workspaceId: "workspace-phase138",
    });

    expect(missing).toEqual({
      kind: "not_member",
      reason: "not_found",
    });

    expect(decideWorkspaceMembershipAccess(missing)).toEqual({
      kind: "denied",
      reason: "membership_not_found",
    });

    const disabled = await repository.getMembership({
      userId: "disabled-user-phase138",
      workspaceId: "workspace-phase138",
    });

    expect(disabled).toEqual({
      kind: "member",
      membership: {
        userId: "disabled-user-phase138",
        workspaceId: "workspace-phase138",
        role: "member",
        status: "disabled",
        source: "workspace_memberships",
      },
    });

    expect(decideWorkspaceMembershipAccess(disabled)).toEqual({
      kind: "denied",
      reason: "membership_inactive",
    });

    const notConfigured = await createWorkspaceMembershipNotConfiguredRepository().getMembership({
      userId: "user-phase138",
      workspaceId: "workspace-phase138",
    });

    expect(decideWorkspaceMembershipAccess(notConfigured)).toEqual({
      kind: "denied",
      reason: "membership_not_configured",
    });
  });

  test("workspace membership repository is not wired into routes rls frontend storage or artifact delivery", async () => {
    const membershipSource = readSource("backend/auth/workspaceMembership.ts");
    const repositorySource = readSource("backend/auth/workspaceMembershipRepository.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const authorizationSource = readSource("backend/auth/exportAuthorization.ts");
    const appSource = readSource("backend/app.ts");

    expect(membershipSource).toContain("WorkspaceMembershipRepository");
    expect(repositorySource).toContain("createInMemoryWorkspaceMembershipRepository");
    expect(repositorySource).toContain("createMembershipKey");
    expect(repositorySource).toContain("not_found");

    // Phase 138 is repository-only. No runtime route/authorization wiring yet.
    expect(routeSource).not.toContain("createInMemoryWorkspaceMembershipRepository");
    expect(routeSource).not.toContain("decideWorkspaceMembershipAccess");
    expect(authorizationSource).not.toContain("createInMemoryWorkspaceMembershipRepository");
    expect(authorizationSource).not.toContain("decideWorkspaceMembershipAccess");
    expect(appSource).not.toContain("createInMemoryWorkspaceMembershipRepository");
    expect(appSource).not.toContain("decideWorkspaceMembershipAccess");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("applyRls");
    expect(routeSource).not.toContain("createSignedUrl");
    expect(routeSource).not.toContain("getPublicUrl");

    expect(repositorySource).not.toContain("@supabase/supabase-js");
    expect(repositorySource).not.toContain("createClient(");
    expect(repositorySource).not.toContain("service_role");
    expect(repositorySource).not.toContain("SERVICE_ROLE");
    expect(repositorySource).not.toContain("applyRls");

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
