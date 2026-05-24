import type { WorkspaceRole } from "./accountContracts";
import type { WorkspaceMembershipRole } from "./workspaceMembership";

export type CanonicalWorkspaceRole =
  | "workspace_owner"
  | "workspace_admin"
  | "workspace_member"
  | "workspace_viewer"
  | "unknown";

export type WorkspaceRoleNormalizationInput =
  | CanonicalWorkspaceRole
  | WorkspaceRole
  | WorkspaceMembershipRole
  | null
  | undefined
  | string;

export const normalizeWorkspaceRole = (
  role: WorkspaceRoleNormalizationInput,
): CanonicalWorkspaceRole => {
  if (!role) {
    return "unknown";
  }

  switch (role) {
    case "workspace_owner":
    case "owner":
      return "workspace_owner";
    case "workspace_admin":
    case "admin":
      return "workspace_admin";
    case "workspace_member":
    case "editor":
    case "member":
      return "workspace_member";
    case "workspace_viewer":
    case "viewer":
      return "workspace_viewer";
    default:
      return "unknown";
  }
};

export const isOwnerOrAdminWorkspaceRole = (
  role: WorkspaceRoleNormalizationInput,
): boolean => {
  const normalizedRole = normalizeWorkspaceRole(role);

  return (
    normalizedRole === "workspace_owner" ||
    normalizedRole === "workspace_admin"
  );
};
