import { Router } from "express";
import type { Response } from "express";
import type { AsyncBackendRequesterContextResolver } from "../auth/requesterContextResolver";
import { resolveSelectedRouteAccess } from "../auth/protectedRouteGuards";
import type { TrustedAuthProviderRuntimeConfig } from "../auth/trustedAuthProviderRuntimeConfig";
import type {
  BackendCreditsPolicyResponse,
  BackendCreditsStatusResponse,
} from "../contracts/creditsHttpTypes";
import { defaultCreditPolicy } from "../credits/creditPolicy";
import { createCreditService, type CreditService } from "../credits/creditService";

export interface CreateCreditsRouterOptions {
  runtimeConfig: TrustedAuthProviderRuntimeConfig;
  creditService?: CreditService;
  routeAccessResolver?: AsyncBackendRequesterContextResolver;
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
  const creditService = options.creditService ?? createCreditService();

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
    (request, response: Response<BackendCreditsStatusResponse>, next) => {
      void (async () => {
        const accessDecision = await resolveSelectedRouteAccess({
          headers: request.headers,
          runtimeConfig: options.runtimeConfig,
          requesterResolver: options.routeAccessResolver,
        });

        if (accessDecision.kind === "allowed") {
          const wallet = await creditService.getWalletStatus(
            accessDecision.requester.workspaceId,
          );
          response.status(200).json({
            kind: "credits_status",
            status: "authenticated",
            message:
              wallet.liveBalanceAvailable
                ? "Credits policy and wallet metadata are visible for this verified session."
                : "Credits policy is visible for this verified session, but platform credits are not configured for paid generation yet.",
            wallet,
          });
          return;
        }

        if (accessDecision.code === "workspace_required") {
          response.status(403).json({
            kind: "credits_access_required",
            status: "workspace_required",
            message: accessDecision.message,
          });
          return;
        }

        if (accessDecision.code === "auth_required") {
          response.status(401).json({
            kind: "credits_sign_in_required",
            status: "unauthenticated",
            reason: "invalid_credentials",
            message:
              "Sign in is required before workspace-owned credit status can be checked.",
          });
          return;
        }

        response.status(503).json({
          kind: "credits_unavailable",
          status:
            accessDecision.code === "workspace_runtime_not_configured"
              ? "workspace_runtime_not_configured"
              : resolveUnavailableStatus(options.runtimeConfig),
          message:
            accessDecision.code === "workspace_runtime_not_configured"
              ? accessDecision.message
              : resolveUnavailableMessage(options.runtimeConfig),
        });
      })().catch(next);
    },
  );

  return router;
};
