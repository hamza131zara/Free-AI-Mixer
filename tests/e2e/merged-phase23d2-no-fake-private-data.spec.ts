import { expect, test } from "@playwright/test";

test.describe("merged phase 23D-2 no fake private data", () => {
  test("dashboard admin credits login and signup remain honest while no fake private data appears", async ({
    page,
  }) => {
    await page.route("**/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "unauthenticated_session",
          status: "unauthenticated",
          reason: "missing_credentials",
          message: "Sign in is required before protected account routes can show verified data.",
        }),
      });
    });

    await page.goto("/dashboard", { waitUntil: "load" });
    await expect(page.getByTestId("protected-route-shell")).toBeVisible();
    await expect(page.getByTestId("dashboard-page")).toHaveCount(0);

    await page.goto("/credits", { waitUntil: "load" });
    await expect(page.getByTestId("protected-route-shell")).toBeVisible();
    await expect(page.getByTestId("credits-page")).toHaveCount(0);

    await page.goto("/admin", { waitUntil: "load" });
    await expect(page.getByTestId("admin-page")).toBeVisible();
    await expect(page.getByTestId("admin-page")).toContainText(
      "Platform admin verification is not enabled yet.",
    );

    await page.goto("/login", { waitUntil: "load" });
    await expect(page.getByTestId("login-page")).toBeVisible();
    await expect(page.getByTestId("login-page")).toContainText("Session state");

    await page.goto("/signup", { waitUntil: "load" });
    await expect(page.getByTestId("signup-page")).toBeVisible();
    await expect(page.getByTestId("signup-page")).toContainText("Session state");
  });
});
