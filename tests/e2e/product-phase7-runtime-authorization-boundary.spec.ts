import { expect, test } from "@playwright/test";
import { resolveArtifactDeliveryRuntimeAuthorization } from "../../backend/artifacts/artifactDeliveryRuntimeAuthorization";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";

test.describe("product phase 7 runtime authorization boundary", () => {
  test("runtime authorization fails closed when delivery auth is disabled or unauthenticated", async () => {
    await expect(
      resolveArtifactDeliveryRuntimeAuthorization({
        requesterContext: {
          kind: "authenticated",
          userId: "owner-1",
          workspaceId: "workspace-1",
          authProvider: "jwt",
          authSubject: "owner-1",
        },
        exportOwnerScope: {
          ownerId: "owner-1",
          workspaceId: "workspace-1",
        },
        authorizationMode: "disabled",
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "authorization_required",
      requesterVerified: false,
      ownerOrWorkspaceAccessAllowed: false,
      workspaceMembershipOrRlsReady: false,
    });

    await expect(
      resolveArtifactDeliveryRuntimeAuthorization({
        requesterContext: {
          kind: "unauthenticated",
          reason: "missing_credentials",
        },
        exportOwnerScope: {
          ownerId: "owner-1",
          workspaceId: "workspace-1",
        },
        authorizationMode: "enforce",
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "authorization_required",
      requesterVerified: false,
      ownerOrWorkspaceAccessAllowed: false,
      workspaceMembershipOrRlsReady: false,
    });
  });

  test("owner match becomes ready only with verified authenticated requester context", async () => {
    await expect(
      resolveArtifactDeliveryRuntimeAuthorization({
        requesterContext: {
          kind: "authenticated",
          userId: "owner-1",
          workspaceId: "workspace-1",
          authProvider: "jwt",
          authSubject: "owner-1",
        },
        exportOwnerScope: {
          ownerId: "owner-1",
          workspaceId: "workspace-1",
        },
        authorizationMode: "enforce",
      }),
    ).resolves.toEqual({
      kind: "ready",
      requesterVerified: true,
      ownerOrWorkspaceAccessAllowed: true,
      workspaceMembershipOrRlsReady: true,
    });
  });

  test("workspace access requires explicit membership readiness and never trusts local dev fallback", async () => {
    const membershipRepository: WorkspaceMembershipRepository = {
      getMembership: async ({ userId, workspaceId }) => ({
        kind: "member",
        membership: {
          userId,
          workspaceId,
          role: "member",
          status: "active",
          source: "workspace_memberships",
        },
      }),
    };

    await expect(
      resolveArtifactDeliveryRuntimeAuthorization({
        requesterContext: {
          kind: "authenticated",
          userId: "editor-1",
          workspaceId: "workspace-1",
          authProvider: "jwt",
          authSubject: "editor-1",
        },
        exportOwnerScope: {
          ownerId: "owner-1",
          workspaceId: "workspace-1",
        },
        authorizationMode: "enforce",
        workspaceMembershipRepository: membershipRepository,
      }),
    ).resolves.toEqual({
      kind: "ready",
      requesterVerified: true,
      ownerOrWorkspaceAccessAllowed: true,
      workspaceMembershipOrRlsReady: true,
    });

    await expect(
      resolveArtifactDeliveryRuntimeAuthorization({
        requesterContext: {
          kind: "authenticated",
          userId: "editor-1",
          workspaceId: "workspace-1",
          authProvider: "jwt",
          authSubject: "editor-1",
        },
        exportOwnerScope: {
          ownerId: "owner-1",
          workspaceId: "workspace-1",
        },
        authorizationMode: "enforce",
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "workspace_or_rls_not_ready",
      requesterVerified: true,
      ownerOrWorkspaceAccessAllowed: false,
      workspaceMembershipOrRlsReady: false,
    });
  });
});
