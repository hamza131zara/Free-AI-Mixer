import type { WorkspaceRole } from "../auth/accountContracts";
import type { BackendRequesterContext } from "../auth/requesterContext";
import type { WorkspaceMembershipRole } from "../auth/workspaceMembership";

export type ProviderKeyAction =
  | "view_provider_catalog"
  | "view_provider_connection_metadata"
  | "add_provider_key"
  | "replace_provider_key"
  | "remove_provider_key"
  | "test_provider_connection"
  | "update_provider_routing_policy"
  | "view_masked_key_fingerprint";

export type ProviderKeyActorRole =
  | "workspace_owner"
  | "workspace_admin"
  | "workspace_member"
  | "workspace_viewer"
  | "platform_admin"
  | "moderator";

export type ProviderKeyRoleInput =
  | ProviderKeyActorRole
  | WorkspaceRole
  | WorkspaceMembershipRole;

export interface ProviderKeyAuthorizationInput {
  action: ProviderKeyAction;
  requesterContext: BackendRequesterContext;
  actorRole?: ProviderKeyRoleInput;
}

export type ProviderKeyAuthorizationDecision =
  | {
      kind: "allowed";
      action: ProviderKeyAction;
      actorRole?: ProviderKeyActorRole;
      canManageProviderKeys: boolean;
    }
  | {
      kind: "denied";
      action: ProviderKeyAction;
      actorRole?: ProviderKeyActorRole;
      reason:
        | "auth_not_configured"
        | "unauthenticated"
        | "workspace_role_required"
        | "workspace_member_forbidden"
        | "workspace_viewer_forbidden"
        | "platform_role_restricted";
    };

const managementActions: ProviderKeyAction[] = [
  "add_provider_key",
  "replace_provider_key",
  "remove_provider_key",
  "test_provider_connection",
  "update_provider_routing_policy",
];

export const isProviderKeyManagementAction = (
  action: ProviderKeyAction,
): boolean => managementActions.includes(action);

export const normalizeProviderKeyActorRole = (
  role?: ProviderKeyRoleInput,
): ProviderKeyActorRole | undefined => {
  if (!role) {
    return undefined;
  }

  switch (role) {
    case "workspace_owner":
    case "workspace_admin":
    case "workspace_member":
    case "workspace_viewer":
    case "platform_admin":
    case "moderator":
      return role;
    case "owner":
      return "workspace_owner";
    case "admin":
      return "workspace_admin";
    case "editor":
    case "member":
      return "workspace_member";
    case "viewer":
      return "workspace_viewer";
    default:
      return undefined;
  }
};

export const decideProviderKeyAuthorization = ({
  action,
  requesterContext,
  actorRole,
}: ProviderKeyAuthorizationInput): ProviderKeyAuthorizationDecision => {
  const normalizedRole = normalizeProviderKeyActorRole(actorRole);

  if (action === "view_provider_catalog") {
    return {
      kind: "allowed",
      action,
      actorRole: normalizedRole,
      canManageProviderKeys: false,
    };
  }

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

  if (!normalizedRole) {
    return {
      kind: "denied",
      action,
      reason: "workspace_role_required",
    };
  }

  if (action === "view_provider_connection_metadata") {
    if (
      normalizedRole === "workspace_owner" ||
      normalizedRole === "workspace_admin" ||
      normalizedRole === "workspace_member" ||
      normalizedRole === "workspace_viewer"
    ) {
      return {
        kind: "allowed",
        action,
        actorRole: normalizedRole,
        canManageProviderKeys:
          normalizedRole === "workspace_owner" ||
          normalizedRole === "workspace_admin",
      };
    }

    return {
      kind: "denied",
      action,
      actorRole: normalizedRole,
      reason: "platform_role_restricted",
    };
  }

  if (action === "view_masked_key_fingerprint" || isProviderKeyManagementAction(action)) {
    if (normalizedRole === "workspace_owner" || normalizedRole === "workspace_admin") {
      return {
        kind: "allowed",
        action,
        actorRole: normalizedRole,
        canManageProviderKeys: true,
      };
    }

    if (normalizedRole === "workspace_member") {
      return {
        kind: "denied",
        action,
        actorRole: normalizedRole,
        reason: "workspace_member_forbidden",
      };
    }

    if (normalizedRole === "workspace_viewer") {
      return {
        kind: "denied",
        action,
        actorRole: normalizedRole,
        reason: "workspace_viewer_forbidden",
      };
    }

    return {
      kind: "denied",
      action,
      actorRole: normalizedRole,
      reason: "platform_role_restricted",
    };
  }

  return {
    kind: "denied",
    action,
    actorRole: normalizedRole,
    reason: "workspace_role_required",
  };
};
