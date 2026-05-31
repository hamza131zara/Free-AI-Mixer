import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  decideProviderKeyAuthorization,
  isProviderKeyManagementAction,
  normalizeProviderKeyActorRole,
  type ProviderKeyAction,
} from "../../backend/authorization/providerKeyAuthorization";
import {
  createAuthenticatedRequesterContext,
  createUnauthenticatedRequesterContext,
} from "../../backend/auth/requesterContext";

const authenticatedRequester = createAuthenticatedRequesterContext({
  userId: "user-1",
  appUserId: "user-1",
  workspaceId: "workspace-1",
  workspaceAuthority: "verified",
  workspaceRole: "workspace_owner",
  authProvider: "supabase",
  authSubject: "auth-subject-1",
});

const unavailableWorkspaceRequester = createAuthenticatedRequesterContext({
  userId: "user-1",
  appUserId: "user-1",
  workspaceAuthority: "not_available",
  workspaceAuthorityReason: "multiple_active_workspace_memberships",
  authProvider: "supabase",
  authSubject: "auth-subject-1",
});

const managementActions: ProviderKeyAction[] = [
  "add_provider_key",
  "replace_provider_key",
  "remove_provider_key",
  "test_provider_connection",
  "update_provider_routing_policy",
];

test.describe("phase32 provider key authorization boundary", () => {
  test("catalog view is public metadata only and never grants management", () => {
    const decision = decideProviderKeyAuthorization({
      action: "view_provider_catalog",
      requesterContext: createUnauthenticatedRequesterContext("auth_not_configured"),
    });

    expect(decision).toEqual({
      kind: "allowed",
      action: "view_provider_catalog",
      actorRole: undefined,
      canManageProviderKeys: false,
    });
  });

  test("management action set is explicit", () => {
    expect(managementActions.every(isProviderKeyManagementAction)).toBe(true);
    expect(isProviderKeyManagementAction("view_provider_catalog")).toBe(false);
    expect(isProviderKeyManagementAction("view_provider_connection_metadata")).toBe(false);
    expect(isProviderKeyManagementAction("view_masked_key_fingerprint")).toBe(false);
  });

  test("unauthenticated requesters cannot view connection metadata or mutate keys", () => {
    for (const reason of ["auth_not_configured", "missing_credentials", "invalid_credentials"] as const) {
      const metadataDecision = decideProviderKeyAuthorization({
        action: "view_provider_connection_metadata",
        requesterContext: createUnauthenticatedRequesterContext(reason),
        actorRole: "workspace_owner",
      });
      const mutationDecision = decideProviderKeyAuthorization({
        action: "add_provider_key",
        requesterContext: createUnauthenticatedRequesterContext(reason),
        actorRole: "workspace_owner",
      });

      expect(metadataDecision).toMatchObject({
        kind: "denied",
        action: "view_provider_connection_metadata",
        reason: reason === "auth_not_configured" ? "auth_not_configured" : "unauthenticated",
      });
      expect(mutationDecision).toMatchObject({
        kind: "denied",
        action: "add_provider_key",
        reason: reason === "auth_not_configured" ? "auth_not_configured" : "unauthenticated",
      });
    }
  });

  test("backend-supplied owner and admin roles can manage provider keys", () => {
    for (const actorRole of ["workspace_owner", "workspace_admin", "owner", "admin"] as const) {
      for (const action of managementActions) {
        const decision = decideProviderKeyAuthorization({
          action,
          requesterContext: authenticatedRequester,
          actorRole,
        });

        expect(decision).toMatchObject({
          kind: "allowed",
          action,
          canManageProviderKeys: true,
        });
      }

      const fingerprintDecision = decideProviderKeyAuthorization({
        action: "view_masked_key_fingerprint",
        requesterContext: authenticatedRequester,
        actorRole,
      });

      expect(fingerprintDecision).toMatchObject({
        kind: "allowed",
        action: "view_masked_key_fingerprint",
        canManageProviderKeys: true,
      });
    }
  });

  test("workspace member and viewer can view metadata but cannot manage keys or view fingerprints", () => {
    for (const actorRole of ["workspace_member", "workspace_viewer", "member", "viewer", "editor"] as const) {
      const metadataDecision = decideProviderKeyAuthorization({
        action: "view_provider_connection_metadata",
        requesterContext: authenticatedRequester,
        actorRole,
      });

      expect(metadataDecision).toMatchObject({
        kind: "allowed",
        action: "view_provider_connection_metadata",
        canManageProviderKeys: false,
      });

      for (const action of [...managementActions, "view_masked_key_fingerprint"] as const) {
        const decision = decideProviderKeyAuthorization({
          action,
          requesterContext: authenticatedRequester,
          actorRole,
        });

        expect(decision).toMatchObject({
          kind: "denied",
          action,
          reason:
            normalizeProviderKeyActorRole(actorRole) === "workspace_member"
              ? "workspace_member_forbidden"
              : "workspace_viewer_forbidden",
        });
      }
    }
  });

  test("platform roles do not bypass workspace provider key authorization", () => {
    for (const actorRole of ["platform_admin", "moderator"] as const) {
      for (const action of [
        "view_provider_connection_metadata",
        "view_masked_key_fingerprint",
        ...managementActions,
      ] as const) {
        const decision = decideProviderKeyAuthorization({
          action,
          requesterContext: authenticatedRequester,
          actorRole,
        });

        expect(decision).toMatchObject({
          kind: "denied",
          action,
          actorRole,
          reason: "platform_role_restricted",
        });
      }
    }
  });

  test("missing or unrecognized backend role is denied for non-catalog actions", () => {
    for (const actorRole of [undefined, "workspace_ghost"] as const) {
      const decision = decideProviderKeyAuthorization({
        action: "add_provider_key",
        requesterContext: authenticatedRequester,
        actorRole,
      });

      expect(decision).toMatchObject({
        kind: "denied",
        action: "add_provider_key",
        reason: "workspace_role_required",
      });
    }
  });

  test("workspace-unavailable requester does not gain provider key authority without an upstream verified role", () => {
    const decision = decideProviderKeyAuthorization({
      action: "add_provider_key",
      requesterContext: unavailableWorkspaceRequester,
    });

    expect(decision).toMatchObject({
      kind: "denied",
      action: "add_provider_key",
      reason: "workspace_role_required",
    });
  });

  test("authorization helper source remains pure and does not add live BYOK runtime", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "authorization", "providerKeyAuthorization.ts"),
      "utf8",
    );

    expect(source).not.toContain("Router");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("providerSecretVault");
    expect(source).not.toContain("apiKey");
    expect(source).not.toContain("plaintextKey");
    expect(source).not.toContain("encryptedPayload");
  });
});
