import type { Response } from "express";
import type { CanonicalWorkspaceRole } from "./workspaceRoleNormalization";

export type ProtectedRouteDeniedReason =
  | "auth_not_configured"
  | "sign_in_required"
  | "workspace_required"
  | "membership_not_found"
  | "membership_inactive"
  | "owner_admin_required"
  | "auth_unavailable";

export type ProtectedRouteGuardDecision =
  | {
      kind: "allowed";
      verified: true;
    }
  | {
      kind: "denied";
      verified: false;
      reason: ProtectedRouteDeniedReason;
      statusCode: 401 | 403 | 503;
      message: string;
      requiredRole?: CanonicalWorkspaceRole;
    };

export const toProtectedRouteDeniedDecision = (
  reason: ProtectedRouteDeniedReason,
): Extract<ProtectedRouteGuardDecision, { kind: "denied" }> => {
  switch (reason) {
    case "auth_not_configured":
      return {
        kind: "denied",
        verified: false,
        reason,
        statusCode: 503,
        message: "Authentication is not configured on this backend yet.",
      };
    case "workspace_required":
      return {
        kind: "denied",
        verified: false,
        reason,
        statusCode: 403,
        message: "A verified workspace is required before this protected route can continue.",
      };
    case "membership_not_found":
      return {
        kind: "denied",
        verified: false,
        reason,
        statusCode: 403,
        message: "Workspace membership could not be verified for this protected route.",
      };
    case "membership_inactive":
      return {
        kind: "denied",
        verified: false,
        reason,
        statusCode: 403,
        message: "Workspace membership is not active for this protected route.",
      };
    case "owner_admin_required":
      return {
        kind: "denied",
        verified: false,
        reason,
        statusCode: 403,
        message:
          "Workspace owner or workspace admin permission is required before this protected route can continue.",
        requiredRole: "workspace_admin",
      };
    case "auth_unavailable":
      return {
        kind: "denied",
        verified: false,
        reason,
        statusCode: 503,
        message: "Authentication is configured but not available in this product phase.",
      };
    case "sign_in_required":
    default:
      return {
        kind: "denied",
        verified: false,
        reason: "sign_in_required",
        statusCode: 401,
        message: "Sign in is required before this protected route can continue.",
      };
  }
};

export const sendProtectedRouteGuardDecision = (
  response: Response,
  decision: ProtectedRouteGuardDecision,
): void => {
  if (decision.kind === "allowed") {
    return;
  }

  response.status(decision.statusCode).json({
    code: decision.reason,
    message: decision.message,
  });
};
