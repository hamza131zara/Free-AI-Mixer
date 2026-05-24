import { expect, test } from "@playwright/test";
import { resolveAdminMetricCatalog } from "../../backend/admin/adminMetricCatalog";

test.describe("product phase 18 admin metric catalog", () => {
  test("metric catalog groups metrics by required prerequisite", () => {
    const catalog = resolveAdminMetricCatalog();

    expect(catalog).toMatchObject({
      kind: "admin_metric_catalog",
      liveMetricsEnabled: false,
      fakeMetricsAllowed: false,
    });
    expect(catalog.groups.map((group) => group.groupId)).toEqual(
      expect.arrayContaining([
        "readiness_now",
        "requires_real_auth_users_workspaces",
        "requires_event_logging",
        "requires_byok_provider_connections",
        "requires_generation_export_runtime",
        "requires_credits_billing",
        "requires_storage_artifacts",
      ]),
    );
    expect(
      catalog.groups
        .flatMap((group) => group.metrics)
        .some((metric) => metric.metricId === "total_users" && metric.dependencyLabel === "Unavailable until real auth/workspace data"),
    ).toBe(true);
    expect(
      catalog.groups
        .flatMap((group) => group.metrics)
        .some((metric) => metric.metricId === "revenue" && metric.dependencyLabel === "Unavailable until credit ledger/billing runtime"),
    ).toBe(true);
  });
});
