import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const listFrontendSourceFiles = (directory: string): string[] => {
  const fullPath = path.join(projectRoot, directory);
  const entries = readdirSync(fullPath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const relativePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listFrontendSourceFiles(relativePath);
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      return [relativePath];
    }

    return [];
  });
};

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("product phase 2 auth shell", () => {
  test("login page renders with honest auth boundary copy", async ({ page }) => {
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

    await page.goto("/login", { waitUntil: "load" });

    await expect(page.getByTestId("login-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.getByText("Authentication is not configured on this backend yet.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Request login" })).toBeVisible();
  });

  test("signup page renders with honest auth boundary copy", async ({ page }) => {
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

    await page.goto("/signup", { waitUntil: "load" });

    await expect(page.getByTestId("signup-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign up" })).toBeVisible();
    await expect(page.getByText("Authentication is not configured on this backend yet.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Request sign up" })).toBeVisible();
  });

  test("dashboard route stays protected and shows no fake authenticated account by default", async ({
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

    await page.goto("/dashboard", { waitUntil: "load" });

    await expect(page.getByTestId("dashboard-page")).toBeVisible();
    await expect(page.getByTestId("dashboard-session-state")).toContainText("unavailable");
    await expect(page.getByTestId("dashboard-session-state")).toContainText(
      "Authentication is not configured on this backend yet.",
    );
    await expect(page.getByTestId("dashboard-protected-state")).toBeVisible();
    await expect(page.getByTestId("dashboard-page")).not.toContainText("demo-user");
    await expect(page.getByTestId("dashboard-page")).not.toContainText("fake-user");
  });

  test("logout clears verified session state in the frontend store", async ({ page }) => {
    let sessionRequests = 0;

    await page.route("**/auth/session", async (route) => {
      sessionRequests += 1;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "authenticated_session",
          status: "authenticated",
          message: "Backend session verified.",
          identity: {
            userId: "verified-user-001",
            workspaceId: "workspace-001",
            authProvider: "session",
            authSubject: "verified-user-001",
          },
        }),
      });
    });

    await page.route("**/auth/logout", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "logged_out",
          status: "unauthenticated",
          message: "Backend session cleared.",
        }),
      });
    });

    await page.goto("/dashboard", { waitUntil: "load" });

    await expect(page.getByTestId("verified-identity-card")).toContainText("verified-user-001");
    await page.getByTestId("dashboard-page").getByRole("button", { name: "Log out" }).click();

    await expect(page.getByTestId("dashboard-session-state")).toContainText("unauthenticated");
    await expect(page.getByTestId("dashboard-protected-state")).toBeVisible();
    await expect(page.getByTestId("dashboard-page")).not.toContainText("verified-user-001");
    expect(sessionRequests).toBeGreaterThan(0);
  });

  test("frontend source still avoids fake auth shortcuts supabase client storage and service-role exposure", async () => {
    const frontendSource = listFrontendSourceFiles("src")
      .map((relativePath) => readSource(relativePath))
      .join("\n");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain("SERVICE_ROLE");
    expect(frontendSource).not.toContain("demo-user");
    expect(frontendSource).not.toContain("fake-user");
    expect(frontendSource).not.toContain("fake-session");
  });
});
