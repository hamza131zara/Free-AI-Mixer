import { Router } from "express";
import type { Response } from "express";
import { getRequesterContextFromRequest } from "../auth/trustedAuthMiddleware";
import type { TrustedAuthProviderRuntimeConfig } from "../auth/trustedAuthProviderRuntimeConfig";
import type { BackendAdminStatusResponse } from "../contracts/adminHttpTypes";
import type {
  BackendAdminAnalyticsUnavailableResponse,
  BackendAdminReadinessResponse,
} from "../contracts/adminAnalyticsHttpTypes";
import { resolveAdminAnalyticsReadiness } from "../admin/adminAnalyticsReadiness";
import { decideAdminRouteGuard } from "../admin/adminRouteGuards";
import { resolveAdminMetricCatalog } from "../admin/adminMetricCatalog";
import { resolveAdminReadiness } from "../admin/adminReadiness";
import type { PlatformAdminAction } from "../authorization/platformAdminAuthorization";

export interface CreateAdminRouterOptions {
  runtimeConfig: TrustedAuthProviderRuntimeConfig;
}

export const createAdminRouter = (
  options: CreateAdminRouterOptions,
): Router => {
  const router = Router();

  const buildAdminReadinessPayload = (
    request: Parameters<typeof resolveAdminReadiness>[0]["requesterContext"],
  ): BackendAdminReadinessResponse => {
    const readiness = resolveAdminReadiness({
      requesterContext: request,
      runtimeConfig: options.runtimeConfig,
    });

    return {
      kind: "admin_readiness",
      status: readiness.status,
      message: readiness.message,
      noindexRequired: readiness.noindexRequired,
      verifiedAdminSessionRequired: readiness.verifiedAdminSessionRequired,
      platformRolesConfigured: readiness.platformRolesConfigured,
      analyticsReadiness: resolveAdminAnalyticsReadiness(),
      metricCatalog: resolveAdminMetricCatalog(),
    };
  };

  const resolveStatusCode = (status: BackendAdminStatusResponse["status"]): number =>
    status === "auth_not_configured"
      ? 503
      : status === "sign_in_required"
        ? 401
        : 403;

  const analyticsRouteRequirements: Record<
    BackendAdminAnalyticsUnavailableResponse["metricGroup"],
    {
      action: PlatformAdminAction;
      requiredPrerequisites: string[];
      dependencyLabel: string;
      metricCatalogGroupId?: BackendAdminAnalyticsUnavailableResponse["metricCatalogGroupId"];
    }
  > = {
    overview: {
      action: "view_admin_analytics_live",
      requiredPrerequisites: [
        "verified platform_admin auth",
        "real user/workspace database truth",
        "event logging pipeline",
      ],
      dependencyLabel: "Unavailable until verified platform_admin and real data sources",
    },
    users: {
      action: "view_platform_users_later",
      requiredPrerequisites: [
        "verified platform_admin auth",
        "real auth/users/workspaces",
      ],
      dependencyLabel: "Unavailable until real auth/workspace data",
      metricCatalogGroupId: "requires_real_auth_users_workspaces",
    },
    workspaces: {
      action: "view_platform_users_later",
      requiredPrerequisites: [
        "verified platform_admin auth",
        "real auth/users/workspaces",
      ],
      dependencyLabel: "Unavailable until real auth/workspace data",
      metricCatalogGroupId: "requires_real_auth_users_workspaces",
    },
    providers: {
      action: "view_admin_analytics_live",
      requiredPrerequisites: [
        "verified platform_admin auth",
        "BYOK vault/storage",
        "provider verification",
      ],
      dependencyLabel: "Unavailable until BYOK vault/storage",
      metricCatalogGroupId: "requires_byok_provider_connections",
    },
    generation: {
      action: "view_admin_analytics_live",
      requiredPrerequisites: [
        "verified platform_admin auth",
        "generation runtime",
      ],
      dependencyLabel: "Unavailable until generation/export runtime",
      metricCatalogGroupId: "requires_generation_export_runtime",
    },
    exports: {
      action: "view_admin_analytics_live",
      requiredPrerequisites: [
        "verified platform_admin auth",
        "export/render runtime",
      ],
      dependencyLabel: "Unavailable until generation/export runtime",
      metricCatalogGroupId: "requires_generation_export_runtime",
    },
    credits: {
      action: "view_admin_analytics_live",
      requiredPrerequisites: [
        "verified platform_admin auth",
        "credit ledger",
      ],
      dependencyLabel: "Unavailable until credit ledger/billing runtime",
      metricCatalogGroupId: "requires_credits_billing",
    },
    billing: {
      action: "view_billing_analytics_later",
      requiredPrerequisites: [
        "verified platform_admin auth",
        "billing runtime",
      ],
      dependencyLabel: "Unavailable until credit ledger/billing runtime",
      metricCatalogGroupId: "requires_credits_billing",
    },
    storage: {
      action: "view_admin_analytics_live",
      requiredPrerequisites: [
        "verified platform_admin auth",
        "storage provider",
      ],
      dependencyLabel: "Unavailable until storage/artifact provider",
      metricCatalogGroupId: "requires_storage_artifacts",
    },
    errors: {
      action: "view_admin_analytics_live",
      requiredPrerequisites: [
        "verified platform_admin auth",
        "event logging pipeline",
        "generation/export runtime",
      ],
      dependencyLabel: "Unavailable until event logging",
      metricCatalogGroupId: "requires_event_logging",
    },
  };

  const sendAnalyticsUnavailable = (
    metricGroup: BackendAdminAnalyticsUnavailableResponse["metricGroup"],
    response: Response<BackendAdminAnalyticsUnavailableResponse>,
    requesterContext: ReturnType<typeof getRequesterContextFromRequest>,
  ): void => {
    const readiness = resolveAdminReadiness({
      requesterContext,
      runtimeConfig: options.runtimeConfig,
    });
    const requirements = analyticsRouteRequirements[metricGroup];
    const routeGuardDecision = decideAdminRouteGuard({
      action: requirements.action,
      requesterContext,
      adminToolsEnabled: false,
      liveAnalyticsEnabled: false,
    });

    response.status(resolveStatusCode(readiness.status)).json({
      kind: "admin_analytics_unavailable",
      status: readiness.status,
      message:
        routeGuardDecision.kind === "denied"
          ? routeGuardDecision.message
          : readiness.status === "not_enabled_yet"
            ? "Admin analytics are not enabled yet. Real platform admin auth and trusted backend data sources remain future work."
            : readiness.message,
      metricGroup,
      requiredPrerequisites: requirements.requiredPrerequisites,
      dependencyLabel: requirements.dependencyLabel,
      noindexRequired: true,
      verifiedAdminSessionRequired: true,
      platformAdminRoleRequired: true,
      liveMetricsEnabled: false,
      fakeMetricsAllowed: false,
      ...(requirements.metricCatalogGroupId
        ? { metricCatalogGroupId: requirements.metricCatalogGroupId }
        : {}),
    });
  };

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

  router.get(
    "/admin/readiness",
    (request, response: Response<BackendAdminReadinessResponse>) => {
      const requesterContext = getRequesterContextFromRequest(request);
      const payload = buildAdminReadinessPayload(requesterContext);
      response.status(resolveStatusCode(payload.status)).json(payload);
    },
  );

  for (const metricGroup of Object.keys(analyticsRouteRequirements) as Array<
    BackendAdminAnalyticsUnavailableResponse["metricGroup"]
  >) {
    router.get(
      `/admin/analytics/${metricGroup}`,
      (request, response: Response<BackendAdminAnalyticsUnavailableResponse>) => {
        sendAnalyticsUnavailable(metricGroup, response, getRequesterContextFromRequest(request));
      },
    );
  }

  return router;
};
