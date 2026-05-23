import { Router } from "express";
import type { Response } from "express";
import { getRequesterContextFromRequest } from "../auth/trustedAuthMiddleware";
import type { TrustedAuthProviderRuntimeConfig } from "../auth/trustedAuthProviderRuntimeConfig";
import type { BackendAdminStatusResponse } from "../contracts/adminHttpTypes";
import { resolveAdminReadiness } from "../admin/adminReadiness";

export interface CreateAdminRouterOptions {
  runtimeConfig: TrustedAuthProviderRuntimeConfig;
}

export const createAdminRouter = (
  options: CreateAdminRouterOptions,
): Router => {
  const router = Router();

  router.get(
    "/admin/status",
    (request, response: Response<BackendAdminStatusResponse>) => {
      const readiness = resolveAdminReadiness({
        requesterContext: getRequesterContextFromRequest(request),
        runtimeConfig: options.runtimeConfig,
      });

      const statusCode =
        readiness.status === "auth_not_configured"
          ? 503
          : readiness.status === "sign_in_required"
            ? 401
            : 403;

      response.status(statusCode).json(readiness);
    },
  );

  return router;
};
