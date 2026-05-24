import type {
  AdminAnalyticsReadinessSummary,
  AdminMetricCatalogSummary,
} from "../types/adminAnalytics";

export const fallbackAdminAnalyticsReadiness: AdminAnalyticsReadinessSummary = {
  kind: "admin_analytics_readiness",
  liveAnalyticsEnabled: false,
  fakeMetricsAllowed: false,
  platformAdminRequiredLater: true,
  indicators: [
    {
      indicatorId: "auth_runtime_readiness",
      displayName: "Auth runtime readiness",
      label: "Readiness indicator",
      availability: "readiness_only",
      safeNow: true,
      summary:
        "Production auth remains a readiness boundary only. Verified platform-admin runtime enforcement is not enabled yet.",
    },
    {
      indicatorId: "workspace_lookup_readiness",
      displayName: "Workspace lookup readiness",
      label: "Readiness indicator",
      availability: "readiness_only",
      safeNow: true,
      summary:
        "Workspace lookup exists as a planned backend contract and remains disabled for live analytics.",
    },
    {
      indicatorId: "provider_key_vault_readiness",
      displayName: "Provider key vault readiness",
      label: "Readiness indicator",
      availability: "readiness_only",
      safeNow: true,
      summary:
        "Secure provider key storage is not enabled yet, so BYOK analytics remain unavailable.",
    },
    {
      indicatorId: "monitoring_logging_readiness",
      displayName: "Monitoring and logging readiness",
      label: "Readiness indicator",
      availability: "readiness_only",
      safeNow: true,
      summary:
        "Monitoring and logging readiness boundaries exist, but they are not a live analytics dashboard.",
    },
  ],
};

export const fallbackAdminMetricCatalog: AdminMetricCatalogSummary = {
  kind: "admin_metric_catalog",
  liveMetricsEnabled: false,
  fakeMetricsAllowed: false,
  groups: [
    {
      groupId: "readiness_now",
      displayName: "Readiness indicators available now",
      description: "Truthful readiness boundaries only. No live activity totals are shown.",
      metrics: [
        {
          metricId: "auth_runtime_readiness",
          displayName: "Auth runtime readiness",
          description: "Shows whether production auth is still readiness-only.",
          category: "readiness_now",
          availability: "readiness_only",
          requiredPrerequisites: [],
          safeNow: true,
          dependencyLabel: "Readiness indicator",
        },
      ],
    },
    {
      groupId: "requires_real_auth_users_workspaces",
      displayName: "Requires real auth, users, and workspaces",
      description: "These metrics need verified platform-admin auth and real user/workspace data.",
      metrics: [
        {
          metricId: "total_users",
          displayName: "Total users",
          description: "Total verified app users later.",
          category: "requires_real_auth_users_workspaces",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "real auth/users/workspaces"],
          safeNow: false,
          reasonUnavailable: "Real auth and workspace data are not enabled yet.",
          dependencyLabel: "Unavailable until real auth/workspace data",
        },
      ],
    },
    {
      groupId: "requires_event_logging",
      displayName: "Requires event logging",
      description: "These metrics need a backend-owned event pipeline.",
      metrics: [
        {
          metricId: "active_users",
          displayName: "Active users",
          description: "Active users later measured from backend events.",
          category: "requires_event_logging",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "event logging pipeline"],
          safeNow: false,
          reasonUnavailable: "Event logging does not exist yet.",
          dependencyLabel: "Unavailable until event logging",
        },
      ],
    },
    {
      groupId: "requires_byok_provider_connections",
      displayName: "Requires BYOK provider connections",
      description: "These metrics need real vault-backed provider connection truth.",
      metrics: [
        {
          metricId: "connected_provider_count",
          displayName: "Connected providers",
          description: "How many providers are really connected later.",
          category: "requires_byok_provider_connections",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "BYOK vault/storage"],
          safeNow: false,
          reasonUnavailable: "BYOK storage is not enabled.",
          dependencyLabel: "Unavailable until BYOK vault/storage",
        },
      ],
    },
    {
      groupId: "requires_generation_export_runtime",
      displayName: "Requires generation and export runtime",
      description: "These metrics need truthful backend execution.",
      metrics: [
        {
          metricId: "generation_attempts",
          displayName: "Generation attempts",
          description: "Real generation attempts later.",
          category: "requires_generation_export_runtime",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "generation runtime"],
          safeNow: false,
          reasonUnavailable: "Generation runtime remains disabled.",
          dependencyLabel: "Unavailable until generation/export runtime",
        },
      ],
    },
    {
      groupId: "requires_credits_billing",
      displayName: "Requires credits and billing",
      description: "These metrics need a live credit ledger and billing runtime.",
      metrics: [
        {
          metricId: "revenue",
          displayName: "Revenue",
          description: "Revenue summary later, never fake counts.",
          category: "requires_credits_billing",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "billing runtime"],
          safeNow: false,
          reasonUnavailable: "Billing runtime is not enabled.",
          dependencyLabel: "Unavailable until credit ledger/billing runtime",
        },
      ],
    },
    {
      groupId: "requires_storage_artifacts",
      displayName: "Requires storage and artifact provider truth",
      description: "These metrics need verified storage/artifact providers.",
      metrics: [
        {
          metricId: "storage_usage",
          displayName: "Storage usage",
          description: "Storage footprint later.",
          category: "requires_storage_artifacts",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "storage provider"],
          safeNow: false,
          reasonUnavailable: "Production storage provider truth is not enabled.",
          dependencyLabel: "Unavailable until storage/artifact provider",
        },
      ],
    },
  ],
};
