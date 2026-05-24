import type {
  AdminAnalyticsReadinessDecision,
} from "../admin/adminAnalyticsReadiness";
import type {
  AdminMetricCatalogDecision,
  AdminMetricGroupId,
} from "../admin/adminMetricCatalog";
import type { AdminReadinessStatus } from "../admin/adminReadiness";

export interface BackendAdminReadinessResponse {
  kind: "admin_readiness";
  status: AdminReadinessStatus;
  message: string;
  noindexRequired: true;
  verifiedAdminSessionRequired: true;
  platformRolesConfigured: false;
  analyticsReadiness: AdminAnalyticsReadinessDecision;
  metricCatalog: AdminMetricCatalogDecision;
}

export interface BackendAdminAnalyticsUnavailableResponse {
  kind: "admin_analytics_unavailable";
  status: AdminReadinessStatus;
  message: string;
  metricGroup:
    | "overview"
    | "users"
    | "workspaces"
    | "providers"
    | "generation"
    | "exports"
    | "credits"
    | "billing"
    | "storage"
    | "errors";
  requiredPrerequisites: string[];
  dependencyLabel: string;
  noindexRequired: true;
  verifiedAdminSessionRequired: true;
  platformAdminRoleRequired: true;
  liveMetricsEnabled: false;
  fakeMetricsAllowed: false;
  metricCatalogGroupId?: AdminMetricGroupId;
}
