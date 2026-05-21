import type {
  ExportAuthorizationDecision,
} from "./exportAuthorization";

export type ExportAuthorizationRouteGuardResult =
  | {
      kind: "allowed";
      ownerId: string;
      workspaceId?: string;
    }
  | {
      kind: "blocked";
      statusCode: 401 | 403;
      code: "auth_required" | "forbidden";
      reason:
        | "auth_not_enforced"
        | "local_dev_fallback_not_production_auth"
        | "owner_mismatch"
        | "workspace_mismatch";
    };

/**
 * Phase 86 boundary helper.
 *
 * This maps pure export authorization decisions to future route-safe outcomes.
 * It is intentionally not wired into routes yet.
 *
 * Safety rules:
 * - Must not fabricate authenticated identity.
 * - Must not trust arbitrary headers.
 * - Must not mutate route behavior.
 * - Must not apply RLS policies.
 * - Must not enable public artifact delivery.
 */
export const mapExportAuthorizationDecisionToRouteGuard = (
  decision: ExportAuthorizationDecision,
): ExportAuthorizationRouteGuardResult => {
  if (decision.kind === "authorized") {
    return {
      kind: "allowed",
      ownerId: decision.ownerId,
      workspaceId: decision.workspaceId,
    };
  }

  if (decision.kind === "unauthorized") {
    return {
      kind: "blocked",
      statusCode: 401,
      code: "auth_required",
      reason: decision.reason,
    };
  }

  return {
    kind: "blocked",
    statusCode: 403,
    code: "forbidden",
    reason: decision.reason,
  };
};
