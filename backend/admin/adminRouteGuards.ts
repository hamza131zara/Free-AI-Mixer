import type { Response } from "express";
import type { BackendRequesterContext } from "../auth/requesterContext";
import {
  decidePlatformAdminAuthorization,
  type PlatformAdminAction,
  type PlatformAdminActorRole,
} from "../authorization/platformAdminAuthorization";

export type AdminRouteGuardDeniedReason =
  | "auth_not_configured"
  | "sign_in_required"
  | "platform_role_not_configured"
  | "platform_admin_required"
  | "platform_access_forbidden"
  | "admin_tools_not_enabled"
  | "live_analytics_not_enabled";

export type AdminRouteGuardDecision =
  | {
      kind: "allowed";
      verified: true;
      futurePermittedOnly: true;
    }
  | {
      kind: "denied";
      verified: false;
      reason: AdminRouteGuardDeniedReason;
      statusCode: 401 | 403 | 503;
      message: string;
    };

export interface AdminRouteGuardInput {
  action: PlatformAdminAction;
  requesterContext: BackendRequesterContext;
  actorRole?: PlatformAdminActorRole;
  adminToolsEnabled?: boolean;
  liveAnalyticsEnabled?: boolean;
}

const analyticsActions = new Set<PlatformAdminAction>([
  "view_admin_analytics_live",
]);

const createDeniedDecision = (
  reason: AdminRouteGuardDeniedReason,
): Extract<AdminRouteGuardDecision, { kind: "denied" }> => {
  switch (reason) {
    case "auth_not_configured":
      return {
        kind: "denied",
        verified: false,
        reason,
        statusCode: 503,
        message: "Authentication is not configured on this backend yet.",
      };
    case "sign_in_required":
      return {
        kind: "denied",
        verified: false,
        reason,
        statusCode: 401,
        message: "A verified backend session is required before admin routes can continue.",
      };
    case "platform_role_not_configured":
      return {
        kind: "denied",
        verified: false,
        reason,
        statusCode: 503,
        message:
          "Platform admin verification is not configured yet, so admin authorization remains fail closed in this phase.",
      };
    case "platform_admin_required":
      return {
        kind: "denied",
        verified: false,
        reason,
        statusCode: 403,
        message: "Verified platform admin permission is required before this admin route can continue.",
      };
    case "platform_access_forbidden":
      return {
        kind: "denied",
        verified: false,
        reason,
        statusCode: 403,
        message: "This admin route is not available for the current platform role.",
      };
    case "live_analytics_not_enabled":
      return {
        kind: "denied",
        verified: false,
        reason,
        statusCode: 503,
        message:
          "Live admin analytics are not enabled yet. Verified platform admin auth and trusted backend data sources remain future work.",
      };
    case "admin_tools_not_enabled":
    default:
      return {
        kind: "denied",
        verified: false,
        reason: "admin_tools_not_enabled",
        statusCode: 503,
        message:
          "Admin tools are not enabled yet. Platform role truth and privileged operational access remain backend-verified future work.",
      };
  }
};

export const decideAdminRouteGuard = ({
  action,
  requesterContext,
  actorRole,
  adminToolsEnabled = false,
  liveAnalyticsEnabled = false,
}: AdminRouteGuardInput): AdminRouteGuardDecision => {
  const authorizationDecision = decidePlatformAdminAuthorization({
    action,
    requesterContext,
    actorRole,
  });

  if (authorizationDecision.kind === "denied") {
    switch (authorizationDecision.reason) {
      case "auth_not_configured":
        return createDeniedDecision("auth_not_configured");
      case "unauthenticated":
        return createDeniedDecision("sign_in_required");
      case "platform_role_not_configured":
        return createDeniedDecision("platform_role_not_configured");
      case "platform_admin_required":
        return createDeniedDecision("platform_admin_required");
      case "platform_access_forbidden":
      default:
        return createDeniedDecision("platform_access_forbidden");
    }
  }

  if (analyticsActions.has(action) && !liveAnalyticsEnabled) {
    return createDeniedDecision("live_analytics_not_enabled");
  }

  if (!adminToolsEnabled) {
    return createDeniedDecision("admin_tools_not_enabled");
  }

  return {
    kind: "allowed",
    verified: true,
    futurePermittedOnly: true,
  };
};

export const sendAdminRouteGuardDecision = (
  response: Response,
  decision: AdminRouteGuardDecision,
): void => {
  if (decision.kind === "allowed") {
    return;
  }

  response.status(decision.statusCode).json({
    code: decision.reason,
    message: decision.message,
  });
};
