import { Router } from "express";
import type { Response } from "express";
import type { TrustedAuthProviderRuntimeConfig } from "../auth/trustedAuthProviderRuntimeConfig";
import { getRequesterContextFromRequest } from "../auth/trustedAuthMiddleware";
import type {
  BackendCreditsPolicyResponse,
  BackendCreditsStatusResponse,
} from "../contracts/creditsHttpTypes";
import { defaultCreditPolicy } from "../credits/creditPolicy";

export interface CreateCreditsRouterOptions {
  runtimeConfig: TrustedAuthProviderRuntimeConfig;
}

const resolveUnavailableStatus = (
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
): "auth_not_configured" | "auth_provider_unavailable" =>
  runtimeConfig.kind === "auth_provider_not_configured"
    ? "auth_not_configured"
    : "auth_provider_unavailable";

const resolveUnavailableMessage = (
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
): string =>
  runtimeConfig.kind === "auth_provider_not_configured"
    ? "Authentication is not configured on this backend yet."
    : "Credits status is configured behind auth, but not available in this product phase.";

export const createCreditsRouter = (
  options: CreateCreditsRouterOptions,
): Router => {
  const router = Router();

  router.get(
    "/credits/policy",
    (_request, response: Response<BackendCreditsPolicyResponse>) => {
      response.status(200).json({
        kind: "credits_policy",
        message:
          "Credits policy is available in planning-only form. No balances, purchases, or mutations are enabled.",
        policy: defaultCreditPolicy,
      });
    },
  );

  router.get(
    "/credits/status",
    (request, response: Response<BackendCreditsStatusResponse>) => {
      const requesterContext = getRequesterContextFromRequest(request);

      if (requesterContext.kind === "authenticated") {
        response.status(200).json({
          kind: "credits_status",
          status: "authenticated",
          message:
            "Credits policy is visible for this verified session, but wallet mutation is not enabled yet.",
          wallet: {
            state: "not_enabled_yet",
            scope: "workspace",
            liveBalanceAvailable: false,
            message:
              "A backend-derived wallet summary will appear here only after real credits and billing are implemented.",
            activeWorkspaceId: requesterContext.workspaceId,
          },
        });
        return;
      }

      if (requesterContext.reason === "auth_not_configured") {
        response.status(503).json({
          kind: "credits_unavailable",
          status: "auth_not_configured",
          message: "Authentication is not configured on this backend yet.",
        });
        return;
      }

      if (options.runtimeConfig.kind === "auth_provider_not_configured") {
        response.status(503).json({
          kind: "credits_unavailable",
          status: "auth_not_configured",
          message: "Authentication is not configured on this backend yet.",
        });
        return;
      }

      if (options.runtimeConfig.kind === "auth_provider_configured") {
        response.status(401).json({
          kind: "credits_sign_in_required",
          status: "unauthenticated",
          reason: requesterContext.reason,
          message: "Sign in is required before workspace-owned credit status can be checked.",
        });
        return;
      }

      response.status(503).json({
        kind: "credits_unavailable",
        status: resolveUnavailableStatus(options.runtimeConfig),
        message: resolveUnavailableMessage(options.runtimeConfig),
      });
    },
  );

  return router;
};
