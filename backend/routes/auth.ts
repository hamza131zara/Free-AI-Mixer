import { Router } from "express";
import type { Request, Response } from "express";
import type {
  BackendAuthMutationResponse,
  BackendAuthSessionResponse,
} from "../contracts/authHttpTypes";
import type { AsyncBackendRequesterContextResolver } from "../auth/requesterContextResolver";
import { getRequesterContextFromRequest } from "../auth/trustedAuthMiddleware";
import type { TrustedAuthProviderRuntimeConfig } from "../auth/trustedAuthProviderRuntimeConfig";

export interface CreateAuthRouterOptions {
  runtimeConfig: TrustedAuthProviderRuntimeConfig;
  requesterContextResolver?: AsyncBackendRequesterContextResolver;
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

const resolveAuthenticatedSessionMessage = (
  workspaceAuthority?: "verified" | "not_available",
  workspaceAuthorityReason?:
    | "workspace_runtime_not_enabled"
    | "no_active_workspace_membership"
    | "multiple_active_workspace_memberships",
): string => {
  if (workspaceAuthority === "verified") {
    return "Backend session verified.";
  }

  if (workspaceAuthorityReason === "workspace_runtime_not_enabled") {
    return "Backend identity verified. Workspace authority is not enabled on this backend yet.";
  }

  if (
    workspaceAuthorityReason === "no_active_workspace_membership" ||
    workspaceAuthorityReason === "multiple_active_workspace_memberships"
  ) {
    return "Backend identity verified. Workspace authority is not available yet.";
  }

  return "Backend session verified.";
};

const sendCurrentSession = async (
  request: Request,
  response: Response<BackendAuthSessionResponse>,
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
  requesterContextResolver?: AsyncBackendRequesterContextResolver,
): Promise<void> => {
  const middlewareRequesterContext = getRequesterContextFromRequest(request);
  const requesterContext = requesterContextResolver
    ? await requesterContextResolver.resolve({
        headers: request.headers,
        trustedRequesterContext: middlewareRequesterContext,
      })
    : middlewareRequesterContext;

  if (requesterContext.kind === "authenticated") {
    response.status(200).json({
      kind: "authenticated_session",
      status: "authenticated",
      message: resolveAuthenticatedSessionMessage(
        requesterContext.workspaceAuthority,
        requesterContext.workspaceAuthorityReason,
      ),
      identity: {
        userId: requesterContext.userId,
        ...(requesterContext.appUserId ? { appUserId: requesterContext.appUserId } : {}),
        ...(requesterContext.supabaseUserId
          ? { supabaseUserId: requesterContext.supabaseUserId }
          : {}),
        ...(requesterContext.workspaceId ? { workspaceId: requesterContext.workspaceId } : {}),
        ...(requesterContext.workspaceRole
          ? { workspaceRole: requesterContext.workspaceRole }
          : {}),
        ...(requesterContext.workspaceAuthority
          ? { workspaceAuthority: requesterContext.workspaceAuthority }
          : {}),
        ...(requesterContext.workspaceAuthorityReason
          ? {
              workspaceAuthorityReason:
                requesterContext.workspaceAuthorityReason,
            }
          : {}),
        ...(requesterContext.authProvider
          ? { authProvider: requesterContext.authProvider }
          : {}),
        ...(requesterContext.authSubject
          ? { authSubject: requesterContext.authSubject }
          : {}),
        ...(requesterContext.email ? { email: requesterContext.email } : {}),
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

  if (requesterContext.reason === "auth_provider_unavailable") {
    authUnavailableResponse(
      response,
      "auth_provider_unavailable",
      "Authentication is configured but not available in this product phase.",
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
    (request, response: Response<BackendAuthSessionResponse>, next) => {
      void sendCurrentSession(
        request,
        response,
        options.runtimeConfig,
        options.requesterContextResolver,
      ).catch(next);
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
