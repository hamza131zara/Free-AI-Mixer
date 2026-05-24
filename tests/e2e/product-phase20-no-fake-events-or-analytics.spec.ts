import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveEventLogTaxonomy } from "../../backend/observability/eventLogContracts";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("product phase 20 no fake events or analytics", () => {
  test("admin page remains readiness-only and does not show fake metrics", async ({ page }) => {
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
                summary: "Event logging contracts exist, but runtime recording is disabled.",
              },
            ],
          },
          metricCatalog: {
            kind: "admin_metric_catalog",
            liveMetricsEnabled: false,
            fakeMetricsAllowed: false,
            groups: [
              {
                groupId: "requires_event_logging",
                displayName: "Requires event logging",
                description: "Real event capture and aggregation are required.",
                metrics: [
                  {
                    metricId: "active_users",
                    displayName: "Active users",
                    description: "Verified user activity later.",
                    category: "requires_event_logging",
                    availability: "unavailable_until_prerequisites",
                    requiredPrerequisites: [
                      "verified platform_admin auth",
                      "event logging pipeline",
                    ],
                    safeNow: false,
                    reasonUnavailable: "Event logging is not enabled.",
                    dependencyLabel: "Unavailable until event logging",
                  },
                ],
              },
            ],
          },
        }),
      });
    });

    await page.goto("/admin", { waitUntil: "load" });

    await expect(page.getByTestId("admin-page")).toBeVisible();
    await expect(page.getByTestId("admin-page")).toContainText("Readiness indicator");
    await expect(page.getByTestId("admin-page")).toContainText(
      "Unavailable until event logging",
    );
    await expect(page.getByTestId("admin-page")).not.toContainText("Active users: 1,024");
    await expect(page.getByTestId("admin-page")).not.toContainText("Revenue: $");
    await expect(page.getByTestId("admin-page")).not.toContainText("Connected providers: 6");
  });

  test("event boundaries stay route-unwired and future success claims remain blocked", () => {
    const routeSource = [
      readSource("backend/routes/admin.ts"),
      readSource("backend/routes/auth.ts"),
      readSource("backend/routes/providerSettings.ts"),
      readSource("backend/routes/generation.ts"),
      readSource("backend/routes/exports.ts"),
      readSource("backend/routes/credits.ts"),
      readSource("backend/routes/billing.ts"),
    ].join("\n");
    const frontendSource = [
      readSource("src/pages/AdminPage.tsx"),
      readSource("src/services/adminReadinessService.ts"),
    ].join("\n");
    const taxonomy = resolveEventLogTaxonomy();

    expect(routeSource).not.toContain("eventRecorder");
    expect(routeSource).not.toContain("auditTrailRecorder");
    expect(routeSource).not.toContain("appendEvent(");
    expect(routeSource).not.toContain("appendAuditRecord(");
    expect(frontendSource).not.toContain("localStorage");
    expect(frontendSource).not.toContain("sessionStorage");

    expect(
      taxonomy.entries.find((entry) => entry.eventType === "generation_succeeded"),
    ).toMatchObject({
      safeToEmitNow: false,
      reasonUnavailable: "Generation runtime truth is not enabled yet.",
    });

    expect(
      taxonomy.entries.find((entry) => entry.eventType === "credits_settled"),
    ).toMatchObject({
      safeToEmitNow: false,
      reasonUnavailable: "Credit ledger runtime is not enabled yet.",
    });
  });
});
