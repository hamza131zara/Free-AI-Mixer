import { expect, test } from "@playwright/test";

const readinessBody = {
  kind: "admin_readiness",
  status: "auth_not_configured",
  message: "Authentication is not configured on this backend yet.",
  noindexRequired: true,
  verifiedAdminSessionRequired: true,
  platformRolesConfigured: false,
  analyticsReadiness: {
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
        summary: "Production auth remains a readiness boundary only.",
      },
    ],
  },
  metricCatalog: {
    kind: "admin_metric_catalog",
    liveMetricsEnabled: false,
    fakeMetricsAllowed: false,
    groups: [
      {
        groupId: "requires_real_auth_users_workspaces",
        displayName: "Requires real auth, users, and workspaces",
        description: "Real auth and workspace truth are required.",
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
          {
            metricId: "revenue",
            displayName: "Revenue",
            description: "Revenue summary later.",
            category: "requires_credits_billing",
            availability: "unavailable_until_prerequisites",
            requiredPrerequisites: ["verified platform_admin auth", "billing runtime"],
            safeNow: false,
            reasonUnavailable: "Billing runtime is not enabled.",
            dependencyLabel: "Unavailable until credit ledger/billing runtime",
          },
        ],
      },
    ],
  },
};

test.describe("product phase 18 admin no fake metrics", () => {
  test("admin page shows readiness labels only and no fake numbers", async ({ page }) => {
    await page.route("**/admin/status", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "admin_unavailable",
          status: "auth_not_configured",
          message: "Authentication is not configured on this backend yet.",
          noindexRequired: true,
          verifiedAdminSessionRequired: true,
          platformRolesConfigured: false,
        }),
      });
    });

    await page.route("**/admin/readiness", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify(readinessBody),
      });
    });

    await page.goto("/admin", { waitUntil: "load" });

    await expect(page.getByTestId("admin-page")).toBeVisible();
    await expect(page.getByTestId("admin-readiness-grid")).toContainText("Readiness indicator");
    await expect(page.getByTestId("admin-metric-catalog")).toContainText(
      "Unavailable until real auth/workspace data",
    );
    await expect(page.getByTestId("admin-page")).toContainText(
      "Unavailable until credit ledger/billing runtime",
    );
    await expect(page.getByTestId("admin-page")).not.toContainText("Total users: 1,024");
    await expect(page.getByTestId("admin-page")).not.toContainText("Revenue: $");
    await expect(page.getByTestId("admin-page")).not.toContainText("Generation count");
    await expect(page.getByTestId("admin-page")).not.toContainText("Connected providers: 6");
  });
});
