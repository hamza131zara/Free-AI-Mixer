import type {
  BackendAuthenticatedRequesterContext,
  BackendRequesterContext,
} from "./requesterContext";

export type RequesterContextDecision =
  | {
      kind: "verified_authenticated";
      requester: BackendAuthenticatedRequesterContext;
    }
  | {
      kind:
        | "unauthenticated"
        | "auth_not_configured"
        | "missing_credentials"
        | "invalid_credentials"
        | "missing_workspace";
      message: string;
    };

export interface RequesterContextDecisionOptions {
  requireWorkspace?: boolean;
}

export const decideRequesterContext = (
  requesterContext: BackendRequesterContext,
  options: RequesterContextDecisionOptions = {},
): RequesterContextDecision => {
  if (requesterContext.kind !== "authenticated") {
    if (requesterContext.reason === "auth_not_configured") {
      return {
        kind: "auth_not_configured",
        message: "Authentication is not configured on this backend yet.",
      };
    }

    if (requesterContext.reason === "missing_credentials") {
      return {
        kind: "missing_credentials",
        message: "Sign in is required before this protected route can continue.",
      };
    }

    return {
      kind: "invalid_credentials",
      message: "Sign in is required before this protected route can continue.",
    };
  }

  if (options.requireWorkspace && !requesterContext.workspaceId) {
    return {
      kind: "missing_workspace",
      message:
        "A verified workspace is required before this protected route can continue.",
    };
  }

  return {
    kind: "verified_authenticated",
    requester: requesterContext,
  };
};
