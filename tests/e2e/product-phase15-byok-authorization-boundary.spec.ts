import { expect, test } from "@playwright/test";
import {
  decideProviderKeyAuthorization,
  normalizeProviderKeyActorRole,
} from "../../backend/authorization/providerKeyAuthorization";

test.describe("product phase 15 byok authorization boundary", () => {
  test("workspace owner and admin are future-permitted for provider key management decisions", () => {
    const authenticatedRequester = {
      kind: "authenticated" as const,
      userId: "user_owner",
      workspaceId: "workspace_alpha",
    };

    const ownerDecision = decideProviderKeyAuthorization({
      action: "add_provider_key",
      requesterContext: authenticatedRequester,
      actorRole: "owner",
    });
    const adminDecision = decideProviderKeyAuthorization({
      action: "update_provider_routing_policy",
      requesterContext: authenticatedRequester,
      actorRole: "admin",
    });

    expect(ownerDecision).toMatchObject({
      kind: "allowed",
      actorRole: "workspace_owner",
      canManageProviderKeys: true,
    });
    expect(adminDecision).toMatchObject({
      kind: "allowed",
      actorRole: "workspace_admin",
      canManageProviderKeys: true,
    });
  });

  test("workspace member and viewer cannot manage provider keys, and unauthenticated requests fail closed", () => {
    const authenticatedRequester = {
      kind: "authenticated" as const,
      userId: "user_member",
      workspaceId: "workspace_alpha",
    };

    const memberDecision = decideProviderKeyAuthorization({
      action: "replace_provider_key",
      requesterContext: authenticatedRequester,
      actorRole: "member",
    });
    const viewerDecision = decideProviderKeyAuthorization({
      action: "remove_provider_key",
      requesterContext: authenticatedRequester,
      actorRole: "viewer",
    });
    const unauthenticatedDecision = decideProviderKeyAuthorization({
      action: "test_provider_connection",
      requesterContext: {
        kind: "unauthenticated",
        reason: "missing_credentials",
      },
    });
    const authNotConfiguredDecision = decideProviderKeyAuthorization({
      action: "add_provider_key",
      requesterContext: {
        kind: "unauthenticated",
        reason: "auth_not_configured",
      },
    });
    const platformAdminDecision = decideProviderKeyAuthorization({
      action: "view_masked_key_fingerprint",
      requesterContext: authenticatedRequester,
      actorRole: "platform_admin",
    });
    const moderatorDecision = decideProviderKeyAuthorization({
      action: "add_provider_key",
      requesterContext: authenticatedRequester,
      actorRole: "moderator",
    });

    expect(memberDecision).toMatchObject({
      kind: "denied",
      reason: "workspace_member_forbidden",
    });
    expect(viewerDecision).toMatchObject({
      kind: "denied",
      reason: "workspace_viewer_forbidden",
    });
    expect(unauthenticatedDecision).toMatchObject({
      kind: "denied",
      reason: "unauthenticated",
    });
    expect(authNotConfiguredDecision).toMatchObject({
      kind: "denied",
      reason: "auth_not_configured",
    });
    expect(platformAdminDecision).toMatchObject({
      kind: "denied",
      reason: "platform_role_restricted",
    });
    expect(moderatorDecision).toMatchObject({
      kind: "denied",
      reason: "platform_role_restricted",
    });
  });

  test("trusted workspace vocabulary is normalized only inside the provider-key helper", () => {
    expect(normalizeProviderKeyActorRole("owner")).toBe("workspace_owner");
    expect(normalizeProviderKeyActorRole("admin")).toBe("workspace_admin");
    expect(normalizeProviderKeyActorRole("editor")).toBe("workspace_member");
    expect(normalizeProviderKeyActorRole("member")).toBe("workspace_member");
    expect(normalizeProviderKeyActorRole("viewer")).toBe("workspace_viewer");
    expect(normalizeProviderKeyActorRole("platform_admin")).toBe("platform_admin");
    expect(normalizeProviderKeyActorRole("moderator")).toBe("moderator");
  });
});
