import { defaultBillingProviderBoundary } from "../billing/billingProviderBoundary";
import { defaultCreditPolicy } from "../credits/creditPolicy";
import { getMonitoringReadinessSummary } from "../monitoring/monitoringReadiness";
import { createNotConfiguredProviderSecretVault } from "../providers/notConfiguredProviderSecretVault";
import { getProviderCatalog } from "../providers/providerCatalog";
import { resolveProductionAuthReadiness } from "../auth/productionAuthReadiness";
import { resolveWorkspaceMembershipLookupReadiness } from "../auth/workspaceMembershipLookup";

export type AdminAnalyticsReadinessId =
  | "auth_runtime_readiness"
  | "workspace_lookup_readiness"
  | "provider_key_vault_readiness"
  | "provider_catalog_readiness"
  | "credits_policy_readiness"
  | "billing_readiness"
  | "generation_runtime_readiness"
  | "export_render_readiness"
  | "storage_delivery_readiness"
  | "monitoring_logging_readiness"
  | "seo_content_readiness";

export interface AdminAnalyticsReadinessIndicator {
  indicatorId: AdminAnalyticsReadinessId;
  displayName: string;
  label: "Readiness indicator";
  availability: "readiness_only";
  safeNow: true;
  summary: string;
}

export interface AdminAnalyticsReadinessDecision {
  kind: "admin_analytics_readiness";
  liveAnalyticsEnabled: false;
  fakeMetricsAllowed: false;
  platformAdminRequiredLater: true;
  indicators: AdminAnalyticsReadinessIndicator[];
}

const indicator = (
  indicatorId: AdminAnalyticsReadinessId,
  displayName: string,
  summary: string,
): AdminAnalyticsReadinessIndicator => ({
  indicatorId,
  displayName,
  label: "Readiness indicator",
  availability: "readiness_only",
  safeNow: true,
  summary,
});

export const resolveAdminAnalyticsReadiness =
  (): AdminAnalyticsReadinessDecision => {
    const authReadiness = resolveProductionAuthReadiness();
    const workspaceLookup = resolveWorkspaceMembershipLookupReadiness();
    const providerVault = createNotConfiguredProviderSecretVault().getVaultReadiness();
    const monitoringReadiness = getMonitoringReadinessSummary();
    const providerCatalog = getProviderCatalog();

    return {
      kind: "admin_analytics_readiness",
      liveAnalyticsEnabled: false,
      fakeMetricsAllowed: false,
      platformAdminRequiredLater: true,
      indicators: [
        indicator(
          "auth_runtime_readiness",
          "Auth runtime readiness",
          authReadiness.kind === "ready"
            ? "Production auth strategy and JWT config can be represented, but live auth runtime remains disabled."
            : "Production auth is still fail-closed and not fully configured for verified platform-admin analytics.",
        ),
        indicator(
          "workspace_lookup_readiness",
          "Workspace lookup readiness",
          workspaceLookup.liveLookupEnabled
            ? "Workspace lookup is live."
            : "Workspace membership lookup exists as a contract only and remains backend-derived future work.",
        ),
        indicator(
          "provider_key_vault_readiness",
          "Provider key vault readiness",
          providerVault.kind === "vault_unavailable"
            ? providerVault.message
            : "Provider key vault is ready.",
        ),
        indicator(
          "provider_catalog_readiness",
          "Provider catalog readiness",
          providerCatalog.length > 0
            ? "Provider catalog metadata exists, but connection analytics remain blocked until real BYOK storage and verification exist."
            : "Provider catalog is not available yet.",
        ),
        indicator(
          "credits_policy_readiness",
          "Credits policy readiness",
          defaultCreditPolicy.creditsEnabled
            ? "Credits are enabled."
            : "Credits policy exists as planning-only truth; no wallet balances or usage analytics are live.",
        ),
        indicator(
          "billing_readiness",
          "Billing readiness",
          defaultBillingProviderBoundary.message,
        ),
        indicator(
          "generation_runtime_readiness",
          "Generation runtime readiness",
          "Generation runtime boundaries exist, but vendor execution remains disabled by default and cannot supply real analytics yet.",
        ),
        indicator(
          "export_render_readiness",
          "Export and render readiness",
          "Export and render boundaries exist, but durable runtime truth and job analytics remain unavailable.",
        ),
        indicator(
          "storage_delivery_readiness",
          "Storage and delivery readiness",
          "Storage and artifact delivery boundaries exist, but production provider truth and delivery analytics remain unavailable.",
        ),
        indicator(
          "monitoring_logging_readiness",
          "Monitoring and logging readiness",
          monitoringReadiness.message,
        ),
        indicator(
          "seo_content_readiness",
          "SEO and content readiness",
          "Public SEO and editorial readiness are available, but they do not imply live platform analytics.",
        ),
      ],
    };
  };
