import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("product phase 19 admin no fake privilege or metrics", () => {
  test("admin page keeps readiness-only copy and no fake platform-admin privilege", async ({
    page,
  }) => {
    await page.route("**/admin/status", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "admin_status",
          status: "not_enabled_yet",
          message:
            "Platform admin verification is not configured yet, so admin authorization remains fail closed in this phase.",
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
          message:
            "Platform admin verification is not configured yet, so admin authorization remains fail closed in this phase.",
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
                    requiredPrerequisites: [
                      "verified platform_admin auth",
                      "real auth/users/workspaces",
                    ],
                    safeNow: false,
                    reasonUnavailable: "Real auth and workspace data are not enabled yet.",
                    dependencyLabel: "Unavailable until real auth/workspace data",
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
    await expect(page.getByText("Platform roles stay backend-verified only")).toBeVisible();
    await expect(
      page.getByText(
        "Workspace roles are separate from platform roles and must not be treated as platform-wide privileges.",
      ),
    ).toBeVisible();
    await expect(page.getByTestId("admin-page")).not.toContainText("Signed in as platform admin");
    await expect(page.getByTestId("admin-page")).not.toContainText("Total users: 1,024");
    await expect(page.getByTestId("admin-page")).not.toContainText("Revenue: $");
    await expect(page.getByTestId("admin-page")).not.toContainText("Generation count");
    await expect(page.getByTestId("admin-page")).not.toContainText("Connected providers: 6");
  });

  test("frontend admin code does not create fake platform-admin identity or localStorage truth", () => {
    const frontendSource = [
      readSource("src/pages/AdminPage.tsx"),
      readSource("src/services/adminReadinessService.ts"),
      readSource("src/services/adminReadinessFallback.ts"),
    ].join("\n");

    expect(frontendSource).not.toContain("localStorage.setItem(\"platform_admin\"");
    expect(frontendSource).not.toContain("sessionStorage.setItem(\"platform_admin\"");
    expect(frontendSource).not.toContain("fakePlatformAdminUser");
    expect(frontendSource).not.toContain("signedInAsPlatformAdmin");
    expect(frontendSource).toContain("Platform admin verification is not enabled yet");
  });
});
