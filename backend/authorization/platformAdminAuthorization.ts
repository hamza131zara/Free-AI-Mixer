import type { WorkspaceRole } from "../auth/accountContracts";
import type { BackendRequesterContext } from "../auth/requesterContext";
import type {
  CanonicalPlatformRole,
  PlatformRoleNormalizationInput,
} from "../auth/platformRoleNormalization";
import { normalizePlatformRole } from "../auth/platformRoleNormalization";
import type { CanonicalWorkspaceRole } from "../auth/workspaceRoleNormalization";
import type { WorkspaceMembershipRole } from "../auth/workspaceMembership";

export type PlatformAdminAction =
  | "view_admin_status"
  | "view_admin_readiness"
  | "view_admin_analytics_readiness"
  | "view_admin_analytics_live"
  | "view_platform_users_later"
  | "view_billing_analytics_later"
  | "manage_admin_settings_later"
  | "view_moderation_tools_later"
  | "view_support_tools_later";

export type PlatformAdminActorRole =
  | CanonicalPlatformRole
  | CanonicalWorkspaceRole
  | WorkspaceRole
  | WorkspaceMembershipRole;

export interface PlatformAdminAuthorizationInput {
  action: PlatformAdminAction;
  requesterContext: BackendRequesterContext;
  actorRole?: PlatformAdminActorRole;
}

export type PlatformAdminAuthorizationDecision =
  | {
      kind: "allowed";
      action: PlatformAdminAction;
      actorRole: Exclude<CanonicalPlatformRole, "unknown">;
      futurePermittedOnly: true;
    }
  | {
      kind: "denied";
      action: PlatformAdminAction;
      actorRole: CanonicalPlatformRole;
      reason:
        | "auth_not_configured"
        | "unauthenticated"
        | "platform_role_not_configured"
        | "platform_admin_required"
        | "platform_access_forbidden";
    };

const adminOnlyActions: PlatformAdminAction[] = [
  "view_admin_status",
  "view_admin_readiness",
  "view_admin_analytics_readiness",
  "view_admin_analytics_live",
  "view_platform_users_later",
  "view_billing_analytics_later",
  "manage_admin_settings_later",
];

const moderationActions: PlatformAdminAction[] = [
  "view_moderation_tools_later",
];

const supportActions: PlatformAdminAction[] = [
  "view_support_tools_later",
];

export const normalizePlatformAdminActorRole = (
  role?: PlatformRoleNormalizationInput,
): CanonicalPlatformRole => normalizePlatformRole(role);

export const decidePlatformAdminAuthorization = ({
  action,
  requesterContext,
  actorRole,
}: PlatformAdminAuthorizationInput): PlatformAdminAuthorizationDecision => {
  const normalizedRole = normalizePlatformAdminActorRole(actorRole);

  if (requesterContext.kind === "unauthenticated") {
    return {
      kind: "denied",
      action,
      actorRole: normalizedRole,
      reason:
        requesterContext.reason === "auth_not_configured"
          ? "auth_not_configured"
          : "unauthenticated",
    };
  }

  if (normalizedRole === "unknown") {
    return {
      kind: "denied",
      action,
      actorRole: normalizedRole,
      reason: "platform_role_not_configured",
    };
  }

  if (adminOnlyActions.includes(action)) {
    if (normalizedRole === "platform_admin") {
      return {
        kind: "allowed",
        action,
        actorRole: normalizedRole,
        futurePermittedOnly: true,
      };
    }

    if (normalizedRole === "read_only_analyst" && action === "view_admin_analytics_live") {
      return {
        kind: "allowed",
        action,
        actorRole: normalizedRole,
        futurePermittedOnly: true,
      };
    }

    return {
      kind: "denied",
      action,
      actorRole: normalizedRole,
      reason: "platform_admin_required",
    };
  }

  if (moderationActions.includes(action)) {
    if (
      normalizedRole === "platform_admin" ||
      normalizedRole === "platform_moderator"
    ) {
      return {
        kind: "allowed",
        action,
        actorRole: normalizedRole,
        futurePermittedOnly: true,
      };
    }

    return {
      kind: "denied",
      action,
      actorRole: normalizedRole,
      reason: "platform_access_forbidden",
    };
  }

  if (supportActions.includes(action)) {
    if (
      normalizedRole === "platform_admin" ||
      normalizedRole === "platform_moderator" ||
      normalizedRole === "support_agent"
    ) {
      return {
        kind: "allowed",
        action,
        actorRole: normalizedRole,
        futurePermittedOnly: true,
      };
    }

    return {
      kind: "denied",
      action,
      actorRole: normalizedRole,
      reason: "platform_access_forbidden",
    };
  }

  return {
    kind: "denied",
    action,
    actorRole: normalizedRole,
    reason: "platform_access_forbidden",
  };
};
