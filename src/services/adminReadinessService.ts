import type { AdminStatusSummary } from "../types/adminRoles";
import type {
  AdminAnalyticsReadinessSummary,
  AdminMetricCatalogSummary,
} from "../types/adminAnalytics";
import {
  fallbackAdminAnalyticsReadiness,
  fallbackAdminMetricCatalog,
} from "./adminReadinessFallback";

interface BackendAdminReadyResponse {
  kind: "admin_status";
  status: AdminStatusSummary["status"];
  message: string;
  noindexRequired: true;
  verifiedAdminSessionRequired: true;
  platformRolesConfigured: false;
}

interface BackendAdminUnavailableResponse {
  kind: "admin_unavailable" | "admin_sign_in_required";
  status: AdminStatusSummary["status"];
  message: string;
}

interface BackendAdminReadinessResponse {
  kind: "admin_readiness";
  status: AdminStatusSummary["status"];
  message: string;
  noindexRequired: true;
  verifiedAdminSessionRequired: true;
  platformRolesConfigured: false;
  analyticsReadiness: AdminAnalyticsReadinessSummary;
  metricCatalog: AdminMetricCatalogSummary;
}

const parseJson = async <Payload>(
  response: Response,
): Promise<Payload | undefined> => {
  const responseText = await response.text();

  if (!responseText) {
    return undefined;
  }

  return JSON.parse(responseText) as Payload;
};

const getFallbackAnalyticsData = (): Pick<
  AdminStatusSummary,
  "analyticsReadiness" | "metricCatalog"
> => ({
  analyticsReadiness: fallbackAdminAnalyticsReadiness,
  metricCatalog: fallbackAdminMetricCatalog,
});

const getAdminReadinessDetails = async (): Promise<
  Pick<AdminStatusSummary, "analyticsReadiness" | "metricCatalog">
> => {
  try {
    const response = await fetch("/admin/readiness", {
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await parseJson<BackendAdminReadinessResponse>(response);

    if (!payload) {
      return getFallbackAnalyticsData();
    }

    return {
      analyticsReadiness: payload.analyticsReadiness,
      metricCatalog: payload.metricCatalog,
    };
  } catch {
    return getFallbackAnalyticsData();
  }
};

export const getAdminReadinessSummary = async (): Promise<AdminStatusSummary> => {
  try {
    const readinessDetails = await getAdminReadinessDetails();
    const response = await fetch("/admin/status", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const payload = await parseJson<BackendAdminUnavailableResponse>(response);

      if (!payload) {
        return {
          status: "auth_not_configured",
          message: "Authentication is not configured on this backend yet.",
          noindexRequired: true,
          verifiedAdminSessionRequired: true,
          platformRolesConfigured: false,
          ...readinessDetails,
        };
      }

      return {
        status: payload.status,
        message: payload.message,
        noindexRequired: true,
        verifiedAdminSessionRequired: true,
        platformRolesConfigured: false,
        ...readinessDetails,
      };
    }

    const payload = await parseJson<BackendAdminReadyResponse>(response);

    if (!payload) {
      return {
        status: "auth_not_configured",
        message: "Authentication is not configured on this backend yet.",
        noindexRequired: true,
        verifiedAdminSessionRequired: true,
        platformRolesConfigured: false,
        ...readinessDetails,
      };
    }

    return {
      status: payload.status,
      message: payload.message,
      noindexRequired: payload.noindexRequired,
      verifiedAdminSessionRequired: payload.verifiedAdminSessionRequired,
      platformRolesConfigured: payload.platformRolesConfigured,
      ...readinessDetails,
    };
  } catch {
    return {
      status: "auth_not_configured",
      message: "Authentication is not configured on this backend yet.",
      noindexRequired: true,
      verifiedAdminSessionRequired: true,
      platformRolesConfigured: false,
      ...getFallbackAnalyticsData(),
    };
  }
};

export const getAdminReadinessStatus = getAdminReadinessSummary;
