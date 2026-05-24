import { expect, test } from "@playwright/test";
import { decideAdminRouteGuard } from "../../backend/admin/adminRouteGuards";

test.describe("product phase 19 admin route guard fail-closed", () => {
  test("platform-admin-aware guard remains fail closed while admin tools are disabled", () => {
    const authenticatedRequester = {
      kind: "authenticated" as const,
      userId: "platform_user",
      workspaceId: "workspace_alpha",
    };

    expect(
      decideAdminRouteGuard({
        action: "view_admin_status",
        requesterContext: authenticatedRequester,
        actorRole: "platform_admin",
        adminToolsEnabled: false,
      }),
    ).toMatchObject({
      kind: "denied",
      reason: "admin_tools_not_enabled",
      statusCode: 503,
    });

    expect(
      decideAdminRouteGuard({
        action: "view_admin_analytics_live",
        requesterContext: authenticatedRequester,
        actorRole: "platform_admin",
        adminToolsEnabled: false,
        liveAnalyticsEnabled: false,
      }),
    ).toMatchObject({
      kind: "denied",
      reason: "live_analytics_not_enabled",
      statusCode: 503,
    });
  });

  test("workspace roles, missing roles, and unauthenticated requests fail closed", () => {
    const authenticatedRequester = {
      kind: "authenticated" as const,
      userId: "workspace_user",
      workspaceId: "workspace_alpha",
    };

    expect(
      decideAdminRouteGuard({
        action: "view_admin_readiness",
        requesterContext: authenticatedRequester,
        actorRole: "workspace_owner",
      }),
    ).toMatchObject({
      kind: "denied",
      reason: "platform_role_not_configured",
      statusCode: 503,
    });

    expect(
      decideAdminRouteGuard({
        action: "view_admin_readiness",
        requesterContext: authenticatedRequester,
      }),
    ).toMatchObject({
      kind: "denied",
      reason: "platform_role_not_configured",
      statusCode: 503,
    });

    expect(
      decideAdminRouteGuard({
        action: "view_admin_status",
        requesterContext: {
          kind: "unauthenticated",
          reason: "missing_credentials",
        },
      }),
    ).toMatchObject({
      kind: "denied",
      reason: "sign_in_required",
      statusCode: 401,
    });
  });
});
