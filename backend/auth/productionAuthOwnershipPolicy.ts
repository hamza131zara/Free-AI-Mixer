import type { BackendRequesterContext } from "./requesterContext";
import { isOwnerOrAdminWorkspaceRole } from "./workspaceRoleNormalization";
import type { WorkspaceMembershipRole } from "./workspaceMembership";

export type ProductionProtectedSurface =
  | "provider_keys"
  | "generation_jobs"
  | "projects"
  | "generated_artifacts";

export type ProductionAuthOwnershipDecision =
  | {
      kind: "allowed";
      role: WorkspaceMembershipRole;
      surface: ProductionProtectedSurface;
    }
  | {
      kind: "denied";
      reason:
        | "unauthenticated"
        | "workspace_not_verified"
        | "workspace_owner_or_admin_required"
        | "workspace_member_required";
      surface: ProductionProtectedSurface;
      statusCode: 401 | 403;
    };

export interface ProductionAuthOwnershipInput {
  requesterContext: BackendRequesterContext;
  membershipRole?: WorkspaceMembershipRole;
  surface: ProductionProtectedSurface;
}

const ownerAdminSurfaces: ProductionProtectedSurface[] = [
  "provider_keys",
  "generation_jobs",
  "projects",
  "generated_artifacts",
];

/**
 * Launch Block 1 production ownership boundary.
 *
 * This helper is pure policy only. It does not fabricate auth, trust frontend
 * headers, query Supabase, read secrets, apply migrations, or enable provider,
 * billing, storage delivery, signed URL, or download behavior.
 */
export const decideProductionAuthOwnership = ({
  requesterContext,
  membershipRole,
  surface,
}: ProductionAuthOwnershipInput): ProductionAuthOwnershipDecision => {
  if (requesterContext.kind !== "authenticated") {
    return {
      kind: "denied",
      reason: "unauthenticated",
      statusCode: 401,
      surface,
    };
  }

  if (
    requesterContext.workspaceAuthority !== "verified" ||
    !requesterContext.workspaceId
  ) {
    return {
      kind: "denied",
      reason: "workspace_not_verified",
      statusCode: 403,
      surface,
    };
  }

  if (!membershipRole) {
    return {
      kind: "denied",
      reason: "workspace_member_required",
      statusCode: 403,
      surface,
    };
  }

  if (
    ownerAdminSurfaces.includes(surface) &&
    !isOwnerOrAdminWorkspaceRole(membershipRole)
  ) {
    return {
      kind: "denied",
      reason: "workspace_owner_or_admin_required",
      statusCode: 403,
      surface,
    };
  }

  return {
    kind: "allowed",
    role: membershipRole,
    surface,
  };
};
