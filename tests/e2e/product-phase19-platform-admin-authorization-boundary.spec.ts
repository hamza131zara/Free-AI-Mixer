import { expect, test } from "@playwright/test";
import { decidePlatformAdminAuthorization } from "../../backend/authorization/platformAdminAuthorization";

test.describe("product phase 19 platform admin authorization boundary", () => {
  test("platform roles are future-permitted only for their scoped actions", () => {
    const authenticatedRequester = {
      kind: "authenticated" as const,
      userId: "user_platform",
      workspaceId: "workspace_alpha",
    };

    expect(
      decidePlatformAdminAuthorization({
        action: "view_admin_status",
        requesterContext: authenticatedRequester,
        actorRole: "platform_admin",
      }),
    ).toMatchObject({
      kind: "allowed",
      actorRole: "platform_admin",
      futurePermittedOnly: true,
    });

    expect(
      decidePlatformAdminAuthorization({
        action: "view_moderation_tools_later",
        requesterContext: authenticatedRequester,
        actorRole: "platform_moderator",
      }),
    ).toMatchObject({
      kind: "allowed",
      actorRole: "platform_moderator",
      futurePermittedOnly: true,
    });

    expect(
      decidePlatformAdminAuthorization({
        action: "view_support_tools_later",
        requesterContext: authenticatedRequester,
        actorRole: "support_agent",
      }),
    ).toMatchObject({
      kind: "allowed",
      actorRole: "support_agent",
      futurePermittedOnly: true,
    });

    expect(
      decidePlatformAdminAuthorization({
        action: "view_admin_analytics_live",
        requesterContext: authenticatedRequester,
        actorRole: "read_only_analyst",
      }),
    ).toMatchObject({
      kind: "allowed",
      actorRole: "read_only_analyst",
      futurePermittedOnly: true,
    });
  });

  test("workspace roles are not platform admin and insufficient platform roles fail closed", () => {
    const authenticatedRequester = {
      kind: "authenticated" as const,
      userId: "user_workspace",
      workspaceId: "workspace_alpha",
    };

    expect(
      decidePlatformAdminAuthorization({
        action: "view_admin_readiness",
        requesterContext: authenticatedRequester,
        actorRole: "workspace_admin",
      }),
    ).toMatchObject({
      kind: "denied",
      reason: "platform_role_not_configured",
    });

    expect(
      decidePlatformAdminAuthorization({
        action: "view_billing_analytics_later",
        requesterContext: authenticatedRequester,
        actorRole: "platform_moderator",
      }),
    ).toMatchObject({
      kind: "denied",
      reason: "platform_admin_required",
    });

    expect(
      decidePlatformAdminAuthorization({
        action: "view_moderation_tools_later",
        requesterContext: authenticatedRequester,
        actorRole: "read_only_analyst",
      }),
    ).toMatchObject({
      kind: "denied",
      reason: "platform_access_forbidden",
    });
  });

  test("unauthenticated and auth-not-configured requests never become platform admin", () => {
    expect(
      decidePlatformAdminAuthorization({
        action: "view_admin_status",
        requesterContext: {
          kind: "unauthenticated",
          reason: "missing_credentials",
        },
      }),
    ).toMatchObject({
      kind: "denied",
      reason: "unauthenticated",
    });

    expect(
      decidePlatformAdminAuthorization({
        action: "view_admin_status",
        requesterContext: {
          kind: "unauthenticated",
          reason: "auth_not_configured",
        },
      }),
    ).toMatchObject({
      kind: "denied",
      reason: "auth_not_configured",
    });
  });
});
