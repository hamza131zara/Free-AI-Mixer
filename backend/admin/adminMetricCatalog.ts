export type AdminMetricGroupId =
  | "readiness_now"
  | "requires_real_auth_users_workspaces"
  | "requires_event_logging"
  | "requires_byok_provider_connections"
  | "requires_generation_export_runtime"
  | "requires_credits_billing"
  | "requires_storage_artifacts";

export type AdminMetricAvailability =
  | "readiness_only"
  | "unavailable_until_prerequisites";

export interface AdminMetricCatalogEntry {
  metricId: string;
  displayName: string;
  description: string;
  category: AdminMetricGroupId;
  availability: AdminMetricAvailability;
  requiredPrerequisites: string[];
  safeNow: boolean;
  reasonUnavailable?: string;
  dependencyLabel: string;
}

export interface AdminMetricCatalogGroup {
  groupId: AdminMetricGroupId;
  displayName: string;
  description: string;
  metrics: AdminMetricCatalogEntry[];
}

export interface AdminMetricCatalogDecision {
  kind: "admin_metric_catalog";
  liveMetricsEnabled: false;
  fakeMetricsAllowed: false;
  groups: AdminMetricCatalogGroup[];
}

const group = (
  groupId: AdminMetricGroupId,
  displayName: string,
  description: string,
  metrics: AdminMetricCatalogEntry[],
): AdminMetricCatalogGroup => ({
  groupId,
  displayName,
  description,
  metrics,
});

const metric = (
  entry: AdminMetricCatalogEntry,
): AdminMetricCatalogEntry => entry;

export const resolveAdminMetricCatalog = (): AdminMetricCatalogDecision => ({
  kind: "admin_metric_catalog",
  liveMetricsEnabled: false,
  fakeMetricsAllowed: false,
  groups: [
    group(
      "readiness_now",
      "Readiness indicators available now",
      "These are truthful readiness boundaries, not live platform activity metrics.",
      [
        metric({
          metricId: "auth_runtime_readiness",
          displayName: "Auth runtime readiness",
          description: "Shows whether production auth wiring is still readiness-only.",
          category: "readiness_now",
          availability: "readiness_only",
          requiredPrerequisites: [],
          safeNow: true,
          dependencyLabel: "Readiness indicator",
        }),
        metric({
          metricId: "provider_key_vault_readiness",
          displayName: "Provider key vault readiness",
          description: "Shows whether secure BYOK vault storage is enabled yet.",
          category: "readiness_now",
          availability: "readiness_only",
          requiredPrerequisites: [],
          safeNow: true,
          dependencyLabel: "Readiness indicator",
        }),
        metric({
          metricId: "generation_runtime_readiness",
          displayName: "Generation runtime readiness",
          description: "Tracks whether generation runtime remains disabled or is actually executable later.",
          category: "readiness_now",
          availability: "readiness_only",
          requiredPrerequisites: [],
          safeNow: true,
          dependencyLabel: "Readiness indicator",
        }),
      ],
    ),
    group(
      "requires_real_auth_users_workspaces",
      "Requires real auth, users, and workspaces",
      "These metrics depend on real authenticated users and workspace truth from the app database.",
      [
        metric({
          metricId: "total_users",
          displayName: "Total users",
          description: "Total verified app users.",
          category: "requires_real_auth_users_workspaces",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "real auth/users/workspaces"],
          safeNow: false,
          reasonUnavailable: "Real auth and workspace database truth are not enabled yet.",
          dependencyLabel: "Unavailable until real auth/workspace data",
        }),
        metric({
          metricId: "workspace_count",
          displayName: "Workspace count",
          description: "Number of personal and team workspaces.",
          category: "requires_real_auth_users_workspaces",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "real auth/users/workspaces"],
          safeNow: false,
          reasonUnavailable: "Workspace lookup is still readiness-only.",
          dependencyLabel: "Unavailable until real auth/workspace data",
        }),
        metric({
          metricId: "admin_moderator_count",
          displayName: "Admin and moderator roles",
          description: "Count of verified platform roles and safe platform access boundaries.",
          category: "requires_real_auth_users_workspaces",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "real auth/users/workspaces"],
          safeNow: false,
          reasonUnavailable: "Platform role verification is not enabled yet.",
          dependencyLabel: "Unavailable until real auth/workspace data",
        }),
      ],
    ),
    group(
      "requires_event_logging",
      "Requires event logging",
      "These metrics depend on backend-owned event tracking and audit data.",
      [
        metric({
          metricId: "active_users",
          displayName: "Active users",
          description: "Users active over a measured time window.",
          category: "requires_event_logging",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "event logging pipeline"],
          safeNow: false,
          reasonUnavailable: "No trusted event logging pipeline exists yet.",
          dependencyLabel: "Unavailable until event logging",
        }),
        metric({
          metricId: "provider_settings_visits",
          displayName: "Provider settings visits",
          description: "Visits to provider settings and readiness flows.",
          category: "requires_event_logging",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "event logging pipeline"],
          safeNow: false,
          reasonUnavailable: "Frontend page visits are not tracked backend-side yet.",
          dependencyLabel: "Unavailable until event logging",
        }),
        metric({
          metricId: "support_abuse_signals",
          displayName: "Support and abuse signals",
          description: "Contact, support, or abuse events that are safe to aggregate later.",
          category: "requires_event_logging",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "event logging pipeline"],
          safeNow: false,
          reasonUnavailable: "No support or abuse event pipeline exists yet.",
          dependencyLabel: "Unavailable until event logging",
        }),
      ],
    ),
    group(
      "requires_byok_provider_connections",
      "Requires BYOK provider connections",
      "These metrics depend on real secure provider-key storage and verification truth.",
      [
        metric({
          metricId: "connected_provider_count",
          displayName: "Connected providers",
          description: "How many providers are truly connected across workspaces.",
          category: "requires_byok_provider_connections",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "BYOK vault/storage", "provider verification"],
          safeNow: false,
          reasonUnavailable: "Provider vault storage and verification are not enabled.",
          dependencyLabel: "Unavailable until BYOK vault/storage",
        }),
        metric({
          metricId: "provider_verification_failures",
          displayName: "Provider verification failures",
          description: "Distribution of failed provider verifications later.",
          category: "requires_byok_provider_connections",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "BYOK vault/storage", "provider verification"],
          safeNow: false,
          reasonUnavailable: "There are no real provider verification events yet.",
          dependencyLabel: "Unavailable until BYOK vault/storage",
        }),
        metric({
          metricId: "routing_policy_adoption",
          displayName: "Routing policy adoption",
          description: "How workspaces configure manual, priority, auto, and fallback modes.",
          category: "requires_byok_provider_connections",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "BYOK vault/storage"],
          safeNow: false,
          reasonUnavailable: "Real provider routing settings are not enabled.",
          dependencyLabel: "Unavailable until BYOK vault/storage",
        }),
      ],
    ),
    group(
      "requires_generation_export_runtime",
      "Requires generation and export runtime",
      "These metrics require truthful backend execution of generation, render, and export jobs.",
      [
        metric({
          metricId: "generation_attempts",
          displayName: "Generation attempts",
          description: "Total generation attempts later recorded by backend runtime.",
          category: "requires_generation_export_runtime",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "generation runtime"],
          safeNow: false,
          reasonUnavailable: "Generation execution remains disabled by default.",
          dependencyLabel: "Unavailable until generation/export runtime",
        }),
        metric({
          metricId: "export_jobs",
          displayName: "Export jobs",
          description: "Counts of truthful export/render jobs later.",
          category: "requires_generation_export_runtime",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "export/render runtime"],
          safeNow: false,
          reasonUnavailable: "Export and render runtime analytics are not enabled.",
          dependencyLabel: "Unavailable until generation/export runtime",
        }),
        metric({
          metricId: "provider_error_rate",
          displayName: "Provider error rate",
          description: "Aggregated generation/runtime provider failure rates.",
          category: "requires_generation_export_runtime",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "generation runtime", "event logging pipeline"],
          safeNow: false,
          reasonUnavailable: "No real provider execution telemetry exists yet.",
          dependencyLabel: "Unavailable until generation/export runtime",
        }),
      ],
    ),
    group(
      "requires_credits_billing",
      "Requires credits and billing",
      "These metrics require a real credit ledger and billing runtime.",
      [
        metric({
          metricId: "credit_usage",
          displayName: "Credit usage",
          description: "Workspace credit reservations, charges, refunds, and releases.",
          category: "requires_credits_billing",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "credit ledger"],
          safeNow: false,
          reasonUnavailable: "Credits are policy-only and not live yet.",
          dependencyLabel: "Unavailable until credit ledger/billing runtime",
        }),
        metric({
          metricId: "subscription_counts",
          displayName: "Subscription counts",
          description: "Paid subscriptions and plan distribution later.",
          category: "requires_credits_billing",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "billing runtime"],
          safeNow: false,
          reasonUnavailable: "Billing runtime is still draft-only.",
          dependencyLabel: "Unavailable until credit ledger/billing runtime",
        }),
        metric({
          metricId: "revenue",
          displayName: "Revenue",
          description: "Safe summary revenue metrics later, never fake totals.",
          category: "requires_credits_billing",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "billing runtime"],
          safeNow: false,
          reasonUnavailable: "No live billing or payment truth exists yet.",
          dependencyLabel: "Unavailable until credit ledger/billing runtime",
        }),
      ],
    ),
    group(
      "requires_storage_artifacts",
      "Requires storage and artifact provider truth",
      "These metrics require verified storage/artifact providers and retention pipelines.",
      [
        metric({
          metricId: "storage_usage",
          displayName: "Storage usage",
          description: "Storage footprint across artifact providers later.",
          category: "requires_storage_artifacts",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "storage provider"],
          safeNow: false,
          reasonUnavailable: "Production storage provider truth is not enabled.",
          dependencyLabel: "Unavailable until storage/artifact provider",
        }),
        metric({
          metricId: "artifact_count",
          displayName: "Artifact count",
          description: "Durable artifact inventory later.",
          category: "requires_storage_artifacts",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "storage provider", "export/render runtime"],
          safeNow: false,
          reasonUnavailable: "Durable artifact hosting and retention are not live.",
          dependencyLabel: "Unavailable until storage/artifact provider",
        }),
        metric({
          metricId: "download_bandwidth",
          displayName: "Download bandwidth",
          description: "Artifact delivery and bandwidth usage later.",
          category: "requires_storage_artifacts",
          availability: "unavailable_until_prerequisites",
          requiredPrerequisites: ["verified platform_admin auth", "storage provider", "event logging pipeline"],
          safeNow: false,
          reasonUnavailable: "Artifact delivery analytics are not enabled.",
          dependencyLabel: "Unavailable until storage/artifact provider",
        }),
      ],
    ),
  ],
});
