import { Router } from "express";
import type { Request, Response } from "express";
import type {
  BackendAuthMutationResponse,
  BackendAuthSessionResponse,
} from "../contracts/authHttpTypes";
import { getRequesterContextFromRequest } from "../auth/trustedAuthMiddleware";
import type { TrustedAuthProviderRuntimeConfig } from "../auth/trustedAuthProviderRuntimeConfig";

export interface CreateAuthRouterOptions {
  runtimeConfig: TrustedAuthProviderRuntimeConfig;
}

const authUnavailableResponse = (
  response: Response,
  status: "auth_not_configured" | "auth_provider_unavailable",
  message: string,
): Response<BackendAuthSessionResponse> =>
  response.status(status === "auth_not_configured" ? 503 : 501).json({
    kind: "auth_unavailable",
    status,
    message,
  });

const resolveConfiguredProviderAuthUnavailableStatus = (
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
): "auth_not_configured" | "auth_provider_unavailable" =>
  runtimeConfig.kind === "auth_provider_not_configured"
    ? "auth_not_configured"
    : "auth_provider_unavailable";

const resolveConfiguredProviderUnavailableMessage = (
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
): string =>
  runtimeConfig.kind === "auth_provider_not_configured"
    ? "Authentication is not configured on this backend yet."
    : "Authentication is configured but login and signup are not enabled in this product phase.";

const sendCurrentSession = (
  request: Request,
  response: Response<BackendAuthSessionResponse>,
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
): void => {
  const requesterContext = getRequesterContextFromRequest(request);

  if (requesterContext.kind === "authenticated") {
    response.status(200).json({
      kind: "authenticated_session",
      status: "authenticated",
      message: "Backend session verified.",
      identity: {
        userId: requesterContext.userId,
        ...(requesterContext.workspaceId ? { workspaceId: requesterContext.workspaceId } : {}),
        ...(requesterContext.authProvider
          ? { authProvider: requesterContext.authProvider }
          : {}),
        ...(requesterContext.authSubject
          ? { authSubject: requesterContext.authSubject }
          : {}),
      },
    });
    return;
  }

  if (requesterContext.reason === "auth_not_configured") {
    authUnavailableResponse(
      response,
      "auth_not_configured",
      "Authentication is not configured on this backend yet.",
    );
    return;
  }

  response.status(200).json({
    kind: "unauthenticated_session",
    status: "unauthenticated",
    reason: requesterContext.reason,
    message:
      runtimeConfig.kind === "auth_provider_not_configured"
        ? "Authentication is unavailable."
        : "Sign in is required before protected account routes can show verified data.",
  });
};

const sendFailClosedMutationResponse = (
  response: Response<BackendAuthMutationResponse>,
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
): void => {
  authUnavailableResponse(
    response,
    resolveConfiguredProviderAuthUnavailableStatus(runtimeConfig),
    resolveConfiguredProviderUnavailableMessage(runtimeConfig),
  );
};

export const createAuthRouter = (
  options: CreateAuthRouterOptions,
): Router => {
  const router = Router();

  router.get(
    "/auth/session",
    (request, response: Response<BackendAuthSessionResponse>) => {
      sendCurrentSession(request, response, options.runtimeConfig);
    },
  );

  router.post(
    "/auth/logout",
    (_request, response: Response<BackendAuthMutationResponse>) => {
      if (options.runtimeConfig.kind === "auth_provider_not_configured") {
        sendFailClosedMutationResponse(response, options.runtimeConfig);
        return;
      }

      response.status(200).json({
        kind: "logged_out",
        status: "unauthenticated",
        message: "Backend session cleared.",
      });
    },
  );

  router.post(
    "/auth/login",
    (_request, response: Response<BackendAuthMutationResponse>) => {
      sendFailClosedMutationResponse(response, options.runtimeConfig);
    },
  );

  router.post(
    "/auth/signup",
    (_request, response: Response<BackendAuthMutationResponse>) => {
      sendFailClosedMutationResponse(response, options.runtimeConfig);
    },
  );

  return router;
};
