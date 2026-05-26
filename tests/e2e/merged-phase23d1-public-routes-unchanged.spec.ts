import { expect, test } from "@playwright/test";

test.describe("merged phase 23D-1 public routes unchanged", () => {
  test("public routes remain accessible while protected shell stays scoped to selected routes only", async ({
    page,
  }) => {
    await page.route("**/auth/session", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "auth_unavailable",
          status: "auth_not_configured",
          message: "Authentication is not configured on this backend yet.",
        }),
      });
    });

    await page.route("**/admin/status", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "admin_analytics_unavailable",
          status: "analytics_not_configured",
          message: "Admin analytics are not configured on this backend yet.",
        }),
      });
    });

    await page.goto("/pricing", { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: /pricing/i })).toBeVisible();
    await expect(page.getByTestId("protected-route-shell")).toHaveCount(0);

    await page.goto("/login", { waitUntil: "load" });
    await expect(page.getByTestId("login-page")).toBeVisible();
    await expect(page.getByTestId("protected-route-shell")).toHaveCount(0);

    await page.goto("/signup", { waitUntil: "load" });
    await expect(page.getByTestId("signup-page")).toBeVisible();
    await expect(page.getByTestId("protected-route-shell")).toHaveCount(0);

    await page.goto("/admin", { waitUntil: "load" });
    await expect(page.getByTestId("admin-page")).toBeVisible();
    await expect(page.getByTestId("protected-route-shell")).toHaveCount(0);
    await expect(page.getByTestId("admin-page")).toContainText(
      "Platform admin verification is not enabled yet.",
    );
  });
});
