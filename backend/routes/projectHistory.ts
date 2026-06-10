import { Router } from "express";
import type { Response } from "express";
import type { AsyncBackendRequesterContextResolver } from "../auth/requesterContextResolver";
import { resolveSelectedRouteAccess } from "../auth/protectedRouteGuards";
import type { TrustedAuthProviderRuntimeConfig } from "../auth/trustedAuthProviderRuntimeConfig";
import type {
  BackendExportHistoryResponse,
  BackendProjectLibraryResponse,
} from "../contracts/projectHistoryHttpTypes";
import type { ProductionSupabasePersistenceWriter } from "../persistence/productionSupabasePersistenceBoundary";

export interface CreateProjectHistoryRouterOptions {
  runtimeConfig: TrustedAuthProviderRuntimeConfig;
  routeAccessResolver?: AsyncBackendRequesterContextResolver;
  productionPersistenceWriter?: ProductionSupabasePersistenceWriter;
}

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
    (request, response: Response<BackendProjectLibraryResponse>, next) => {
      void (async () => {
        const accessDecision = await resolveSelectedRouteAccess({
          headers: request.headers,
          runtimeConfig: options.runtimeConfig,
          requesterResolver: options.routeAccessResolver,
        });

        if (accessDecision.kind === "allowed") {
          const requesterContext = accessDecision.requester;
          const persistenceReadiness =
            options.productionPersistenceWriter?.getReadiness();
          const persistenceUnavailable =
            !persistenceReadiness ||
            persistenceReadiness.kind === "unavailable";

          response.status(200).json({
            kind: "project_library",
            status: "authenticated",
            message: persistenceUnavailable
              ? "Project library is available for this verified session, but durable Supabase persistence is unavailable; browser-local project state remains local/browser-only."
              : "Project library is available for this verified session.",
            activeWorkspaceId: requesterContext.workspaceId,
            persistence: persistenceUnavailable
              ? "persistence_unavailable"
              : "not_enabled_yet",
            projects: [],
          });
          return;
        }

        if (accessDecision.code === "workspace_required") {
          response.status(403).json({
            kind: "project_library_forbidden",
            status: "workspace_required",
            message: accessDecision.message,
          });
          return;
        }

        if (accessDecision.code === "auth_required") {
          response.status(401).json({
            kind: "project_library_sign_in_required",
            status: "unauthenticated",
            reason: "invalid_credentials",
            message:
              "Sign in is required before account-owned saved projects can appear here.",
          });
          return;
        }

        response.status(503).json({
          kind: "project_library_unavailable",
          status:
            accessDecision.code === "workspace_runtime_not_configured"
              ? "workspace_runtime_not_configured"
              : unavailableStatus(options.runtimeConfig),
          message:
            accessDecision.code === "workspace_runtime_not_configured"
              ? accessDecision.message
              : unavailableMessage(options.runtimeConfig, "projects"),
        });
      })().catch(next);
    },
  );

  router.get(
    "/project-library/history",
    (request, response: Response<BackendExportHistoryResponse>, next) => {
      void (async () => {
        const accessDecision = await resolveSelectedRouteAccess({
          headers: request.headers,
          runtimeConfig: options.runtimeConfig,
          requesterResolver: options.routeAccessResolver,
        });

        if (accessDecision.kind === "allowed") {
          const requesterContext = accessDecision.requester;
          const persistenceReadiness =
            options.productionPersistenceWriter?.getReadiness();
          const persistenceUnavailable =
            !persistenceReadiness ||
            persistenceReadiness.kind === "unavailable";

          response.status(200).json({
            kind: "export_history",
            status: "authenticated",
            message: persistenceUnavailable
              ? "Export history is available for this verified session, but durable Supabase persistence is unavailable; browser-local history remains local/browser-only."
              : "Export history is available for this verified session.",
            activeWorkspaceId: requesterContext.workspaceId,
            historyState: persistenceUnavailable
              ? "persistence_unavailable"
              : "not_enabled_yet",
            exports: [],
          });
          return;
        }

        if (accessDecision.code === "workspace_required") {
          response.status(403).json({
            kind: "export_history_forbidden",
            status: "workspace_required",
            message: accessDecision.message,
          });
          return;
        }

        if (accessDecision.code === "auth_required") {
          response.status(401).json({
            kind: "export_history_sign_in_required",
            status: "unauthenticated",
            reason: "invalid_credentials",
            message:
              "Sign in is required before verified backend export history can appear here.",
          });
          return;
        }

        response.status(503).json({
          kind: "export_history_unavailable",
          status:
            accessDecision.code === "workspace_runtime_not_configured"
              ? "workspace_runtime_not_configured"
              : unavailableStatus(options.runtimeConfig),
          message:
            accessDecision.code === "workspace_runtime_not_configured"
              ? accessDecision.message
              : unavailableMessage(options.runtimeConfig, "history"),
        });
      })().catch(next);
    },
  );

  return router;
};
