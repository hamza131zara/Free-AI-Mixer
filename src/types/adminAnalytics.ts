export type AdminAnalyticsMetricGroupId =
  | "readiness_now"
  | "requires_real_auth_users_workspaces"
  | "requires_event_logging"
  | "requires_byok_provider_connections"
  | "requires_generation_export_runtime"
  | "requires_credits_billing"
  | "requires_storage_artifacts";

export interface AdminAnalyticsReadinessIndicatorSummary {
  indicatorId: string;
  displayName: string;
  label: "Readiness indicator";
  availability: "readiness_only";
  safeNow: true;
  summary: string;
}

export interface AdminAnalyticsReadinessSummary {
  kind: "admin_analytics_readiness";
  liveAnalyticsEnabled: false;
  fakeMetricsAllowed: false;
  platformAdminRequiredLater: true;
  indicators: AdminAnalyticsReadinessIndicatorSummary[];
}

export interface AdminMetricCatalogEntrySummary {
  metricId: string;
  displayName: string;
  description: string;
  category: AdminAnalyticsMetricGroupId;
  availability: "readiness_only" | "unavailable_until_prerequisites";
  requiredPrerequisites: string[];
  safeNow: boolean;
  reasonUnavailable?: string;
  dependencyLabel: string;
}

export interface AdminMetricCatalogGroupSummary {
  groupId: AdminAnalyticsMetricGroupId;
  displayName: string;
  description: string;
  metrics: AdminMetricCatalogEntrySummary[];
}

export interface AdminMetricCatalogSummary {
  kind: "admin_metric_catalog";
  liveMetricsEnabled: false;
  fakeMetricsAllowed: false;
  groups: AdminMetricCatalogGroupSummary[];
}
