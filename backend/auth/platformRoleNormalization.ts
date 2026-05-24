import type { WorkspaceRole } from "./accountContracts";
import type { CanonicalWorkspaceRole } from "./workspaceRoleNormalization";
import type { WorkspaceMembershipRole } from "./workspaceMembership";

export const canonicalPlatformRoles = [
  "platform_admin",
  "platform_moderator",
  "support_agent",
  "read_only_analyst",
  "unknown",
] as const;

export type CanonicalPlatformRole = (typeof canonicalPlatformRoles)[number];

export type PlatformRoleNormalizationInput =
  | CanonicalPlatformRole
  | WorkspaceRole
  | WorkspaceMembershipRole
  | CanonicalWorkspaceRole
  | null
  | undefined
  | string;

export const normalizePlatformRole = (
  role: PlatformRoleNormalizationInput,
): CanonicalPlatformRole => {
  if (!role) {
    return "unknown";
  }

  switch (role) {
    case "platform_admin":
      return "platform_admin";
    case "platform_moderator":
    case "moderator":
      return "platform_moderator";
    case "support_agent":
      return "support_agent";
    case "read_only_analyst":
      return "read_only_analyst";
    default:
      return "unknown";
  }
};

export const isPlatformAdminRole = (
  role: PlatformRoleNormalizationInput,
): boolean => normalizePlatformRole(role) === "platform_admin";

export const isKnownPlatformRole = (
  role: PlatformRoleNormalizationInput,
): role is Exclude<CanonicalPlatformRole, "unknown"> =>
  normalizePlatformRole(role) !== "unknown";
