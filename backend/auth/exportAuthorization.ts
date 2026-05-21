import type { BackendExportJobOwnerScope } from "../contracts/exportHttpTypes";
import type { ExportRequesterContext } from "../requester/exportRequesterContext";

export type ExportAuthorizationDecision =
  | {
      kind: "authorized";
      ownerId: string;
      workspaceId?: string;
    }
  | {
      kind: "unauthorized";
      reason: "auth_not_enforced" | "local_dev_fallback_not_production_auth";
    }
  | {
      kind: "forbidden";
      reason: "owner_mismatch" | "workspace_mismatch";
    };

/**
 * Phase 85 boundary helper.
 *
 * This is a pure decision helper for future route authorization.
 * It does not mutate route behavior and must not be wired into routes yet.
 *
 * Safety rules:
 * - Must not fabricate authenticated identity.
 * - Must not trust arbitrary headers.
 * - Must not treat local_dev_fallback as production authorization.
 * - Must not apply RLS policies.
 * - Must not enable public artifact delivery.
 */
export const decideExportOwnerScopeAccess = (
  requesterContext: ExportRequesterContext,
  requestedScope: BackendExportJobOwnerScope,
): ExportAuthorizationDecision => {
  if (requesterContext.authMode === "local_dev_fallback") {
    return {
      kind: "unauthorized",
      reason: "local_dev_fallback_not_production_auth",
    };
  }

  if (requesterContext.ownerId !== requestedScope.ownerId) {
    return {
      kind: "forbidden",
      reason: "owner_mismatch",
    };
  }

  if (
    requesterContext.workspaceId !== undefined &&
    requestedScope.workspaceId !== undefined &&
    requesterContext.workspaceId !== requestedScope.workspaceId
  ) {
    return {
      kind: "forbidden",
      reason: "workspace_mismatch",
    };
  }

  return {
    kind: "authorized",
    ownerId: requesterContext.ownerId,
    workspaceId: requesterContext.workspaceId,
  };
};
