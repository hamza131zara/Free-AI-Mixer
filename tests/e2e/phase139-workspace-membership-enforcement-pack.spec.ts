import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { decideWorkspaceMembershipEnforcement } from "../../backend/auth/workspaceMembershipEnforcement";
import { createWorkspaceMembershipNotConfiguredRepository } from "../../backend/auth/workspaceMembership";
import { createInMemoryWorkspaceMembershipRepository } from "../../backend/auth/workspaceMembershipRepository";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase139 workspace membership enforcement pack", () => {
  test("workspace membership enforcement allows owner match and active workspace members", async () => {
    const repository = createInMemoryWorkspaceMembershipRepository({
      memberships: [
        {
          userId: "member-phase139",
          workspaceId: "workspace-phase139",
          role: "member",
          status: "active",
          source: "workspace_memberships",
        },
      ],
    });

    await expect(
      decideWorkspaceMembershipEnforcement({
        requesterContext: {
          kind: "authenticated",
          userId: "owner-phase139",
          workspaceId: "workspace-phase139",
          authProvider: "jwt",
          authSubject: "owner-phase139",
        },
        exportScope: {
          ownerId: "owner-phase139",
          workspaceId: "workspace-phase139",
        },
        membershipRepository: repository,
      }),
    ).resolves.toEqual({
      kind: "allowed",
      reason: "owner_match",
      userId: "owner-phase139",
      workspaceId: "workspace-phase139",
    });

    await expect(
      decideWorkspaceMembershipEnforcement({
        requesterContext: {
          kind: "authenticated",
          userId: "member-phase139",
          workspaceId: "workspace-phase139",
          authProvider: "jwt",
          authSubject: "member-phase139",
        },
        exportScope: {
          ownerId: "owner-phase139",
          workspaceId: "workspace-phase139",
        },
        membershipRepository: repository,
      }),
    ).resolves.toEqual({
      kind: "allowed",
      reason: "workspace_member",
      userId: "member-phase139",
      workspaceId: "workspace-phase139",
      role: "member",
    });
  });

  test("workspace membership enforcement denies unauthenticated mismatched inactive missing and not-configured access", async () => {
    const repository = createInMemoryWorkspaceMembershipRepository({
      memberships: [
        {
          userId: "disabled-member-phase139",
          workspaceId: "workspace-phase139",
          role: "member",
          status: "disabled",
          source: "workspace_memberships",
        },
      ],
    });

    await expect(
      decideWorkspaceMembershipEnforcement({
        requesterContext: {
          kind: "unauthenticated",
          reason: "invalid_credentials",
        },
        exportScope: {
          ownerId: "owner-phase139",
          workspaceId: "workspace-phase139",
        },
        membershipRepository: repository,
      }),
    ).resolves.toEqual({
      kind: "denied",
      reason: "unauthenticated",
    });

    await expect(
      decideWorkspaceMembershipEnforcement({
        requesterContext: {
          kind: "authenticated",
          userId: "owner-phase139",
          workspaceId: "different-workspace",
          authProvider: "jwt",
          authSubject: "owner-phase139",
        },
        exportScope: {
          ownerId: "owner-phase139",
          workspaceId: "workspace-phase139",
        },
        membershipRepository: repository,
      }),
    ).resolves.toEqual({
      kind: "denied",
      reason: "workspace_mismatch",
    });

    await expect(
      decideWorkspaceMembershipEnforcement({
        requesterContext: {
          kind: "authenticated",
          userId: "disabled-member-phase139",
          workspaceId: "workspace-phase139",
          authProvider: "jwt",
          authSubject: "disabled-member-phase139",
        },
        exportScope: {
          ownerId: "owner-phase139",
          workspaceId: "workspace-phase139",
        },
        membershipRepository: repository,
      }),
    ).resolves.toEqual({
      kind: "denied",
      reason: "membership_inactive",
    });

    await expect(
      decideWorkspaceMembershipEnforcement({
        requesterContext: {
          kind: "authenticated",
          userId: "missing-member-phase139",
          workspaceId: "workspace-phase139",
          authProvider: "jwt",
          authSubject: "missing-member-phase139",
        },
        exportScope: {
          ownerId: "owner-phase139",
          workspaceId: "workspace-phase139",
        },
        membershipRepository: repository,
      }),
    ).resolves.toEqual({
      kind: "denied",
      reason: "membership_not_found",
    });

    await expect(
      decideWorkspaceMembershipEnforcement({
        requesterContext: {
          kind: "authenticated",
          userId: "member-phase139",
          workspaceId: "workspace-phase139",
          authProvider: "jwt",
          authSubject: "member-phase139",
        },
        exportScope: {
          ownerId: "owner-phase139",
          workspaceId: "workspace-phase139",
        },
        membershipRepository: createWorkspaceMembershipNotConfiguredRepository(),
      }),
    ).resolves.toEqual({
      kind: "denied",
      reason: "membership_not_configured",
    });
  });

  test("workspace membership enforcement is not wired into routes rls frontend storage or artifact delivery", async () => {
    const enforcementSource = readSource("backend/auth/workspaceMembershipEnforcement.ts");
    const membershipSource = readSource("backend/auth/workspaceMembership.ts");
    const repositorySource = readSource("backend/auth/workspaceMembershipRepository.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const authorizationSource = readSource("backend/auth/exportAuthorization.ts");
    const appSource = readSource("backend/app.ts");

    expect(enforcementSource).toContain("decideWorkspaceMembershipEnforcement");
    expect(enforcementSource).toContain("owner_match");
    expect(enforcementSource).toContain("workspace_member");
    expect(membershipSource).toContain("WorkspaceMembershipRepository");
    expect(repositorySource).toContain("createInMemoryWorkspaceMembershipRepository");

    // Phase 139 is backend-only enforcement helper. No route/RLS wiring yet.
    expect(routeSource).not.toContain("decideWorkspaceMembershipEnforcement");
    expect(authorizationSource).not.toContain("decideWorkspaceMembershipEnforcement");
    expect(appSource).not.toContain("decideWorkspaceMembershipEnforcement");

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
