import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 22 no admin analytics or fake events", () => {
  test("admin analytics stays readiness-only and no fake event or audit seed data exists", async ({
    page,
  }) => {
    const adminRouteSource = readSource("backend/routes/admin.ts");
    const adminPageSource = readSource("src/pages/AdminPage.tsx");
    const strategyDoc = readSource("docs/event-audit-persistence-strategy.md");
    const migrationDraft = readSource(
      "backend/db/migrations/0002_event_audit_persistence_draft.sql",
    );

    expect(adminRouteSource).toContain("admin_analytics_unavailable");
    expect(adminRouteSource).toContain("liveMetricsEnabled: false");
    expect(adminRouteSource).toContain("fakeMetricsAllowed: false");
    expect(adminPageSource).not.toContain("Total users: 1,024");
    expect(adminPageSource).not.toContain("Revenue: $");
    expect(adminPageSource).not.toContain("Connected providers: 6");
    expect(strategyDoc).toContain("does not make admin analytics real");
    expect(strategyDoc).toContain("add route hooks");
    expect(migrationDraft).not.toContain("insert into analytics_events");
    expect(migrationDraft).not.toContain("insert into audit_log");

    await page.route("**/admin/status", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "admin_status",
          status: "not_enabled_yet",
          message: "Platform admin verification is not configured yet.",
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
        body: JSON.stringify({
          kind: "admin_readiness",
          status: "not_enabled_yet",
          message: "Platform admin verification is not configured yet.",
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
                indicatorId: "monitoring_logging_readiness",
                displayName: "Monitoring and logging readiness",
                label: "Readiness indicator",
                availability: "readiness_only",
                safeNow: true,
                summary: "Event and audit migration draft exists, but runtime persistence is still disabled.",
              },
            ],
          },
          metricCatalog: {
            kind: "admin_metric_catalog",
            liveMetricsEnabled: false,
            fakeMetricsAllowed: false,
            groups: [],
          },
        }),
      });
    });

    await page.goto("/admin", { waitUntil: "load" });

    await expect(page.getByTestId("admin-page")).toBeVisible();
    await expect(page.getByTestId("admin-page")).toContainText("Readiness indicator");
    await expect(page.getByTestId("admin-page")).not.toContainText("1,024");
    await expect(page.getByTestId("admin-page")).not.toContainText("$12,499");
    await expect(page.getByTestId("admin-page")).not.toContainText("42 generations");
  });
});
