import { Router } from "express";
import type { Response } from "express";
import type { TrustedAuthProviderRuntimeConfig } from "../auth/trustedAuthProviderRuntimeConfig";
import { getRequesterContextFromRequest } from "../auth/trustedAuthMiddleware";
import type {
  BackendExportHistoryResponse,
  BackendProjectLibraryResponse,
} from "../contracts/projectHistoryHttpTypes";

export interface CreateProjectHistoryRouterOptions {
  runtimeConfig: TrustedAuthProviderRuntimeConfig;
}

const isAuthUnavailable = (
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
): boolean => runtimeConfig.kind === "auth_provider_not_configured";

const unavailableStatus = (
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
): "auth_not_configured" | "auth_provider_unavailable" =>
  runtimeConfig.kind === "auth_provider_not_configured"
    ? "auth_not_configured"
    : "auth_provider_unavailable";

const unavailableMessage = (
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
  scope: "projects" | "history",
): string => {
  if (runtimeConfig.kind === "auth_provider_not_configured") {
    return "Authentication is not configured on this backend yet.";
  }

  return scope === "projects"
    ? "Project library is configured behind auth, but not available in this product phase."
    : "Export history is configured behind auth, but not available in this product phase.";
};

export const createProjectHistoryRouter = (
  options: CreateProjectHistoryRouterOptions,
): Router => {
  const router = Router();

  router.get(
    "/project-library/projects",
    (request, response: Response<BackendProjectLibraryResponse>) => {
      const requesterContext = getRequesterContextFromRequest(request);

      if (requesterContext.kind === "authenticated") {
        response.status(200).json({
          kind: "project_library",
          status: "authenticated",
          message:
            "Project library is available for this verified session, but durable saved projects are not enabled yet.",
          activeWorkspaceId: requesterContext.workspaceId,
          persistence: "not_enabled_yet",
          projects: [],
        });
        return;
      }

      if (requesterContext.reason === "auth_not_configured" || isAuthUnavailable(options.runtimeConfig)) {
        response.status(503).json({
          kind: "project_library_unavailable",
          status: unavailableStatus(options.runtimeConfig),
          message: unavailableMessage(options.runtimeConfig, "projects"),
        });
        return;
      }

      response.status(401).json({
        kind: "project_library_sign_in_required",
        status: "unauthenticated",
        reason: requesterContext.reason,
        message: "Sign in is required before account-owned saved projects can appear here.",
      });
    },
  );

  router.get(
    "/project-library/history",
    (request, response: Response<BackendExportHistoryResponse>) => {
      const requesterContext = getRequesterContextFromRequest(request);

      if (requesterContext.kind === "authenticated") {
        response.status(200).json({
          kind: "export_history",
          status: "authenticated",
          message:
            "Export history is available for this verified session, but durable account-linked history is not enabled yet.",
          activeWorkspaceId: requesterContext.workspaceId,
          historyState: "not_enabled_yet",
          exports: [],
        });
        return;
      }

      if (requesterContext.reason === "auth_not_configured" || isAuthUnavailable(options.runtimeConfig)) {
        response.status(503).json({
          kind: "export_history_unavailable",
          status: unavailableStatus(options.runtimeConfig),
          message: unavailableMessage(options.runtimeConfig, "history"),
        });
        return;
      }

      response.status(401).json({
        kind: "export_history_sign_in_required",
        status: "unauthenticated",
        reason: requesterContext.reason,
        message: "Sign in is required before verified backend export history can appear here.",
      });
    },
  );

  return router;
};
