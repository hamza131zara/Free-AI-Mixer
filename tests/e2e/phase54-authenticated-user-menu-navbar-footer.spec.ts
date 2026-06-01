import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const viewportCases = [
  { height: 900, name: "desktop", width: 1440 },
  { height: 820, name: "tablet", width: 900 },
  { height: 844, name: "mobile", width: 390 },
] as const;

const routeCases = [
  "/dashboard",
  "/projects",
  "/history",
  "/settings/providers",
  "/credits",
  "/mixer",
  "/",
] as const;

test.describe("phase54 authenticated user menu navbar footer", () => {
  test("logged-out navbar keeps public product links plus login and signup", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "load" });

    const header = page.locator(".site-header");
    for (const label of [
      "Home",
      "Mixer",
      "Templates",
      "Cards",
      "AI Tools",
      "Compare",
      "AI News",
      "Pricing",
      "Log in",
      "Sign up",
    ]) {
      await expect(header.getByRole("button", { name: label, exact: true })).toBeVisible();
    }

    await expect(header.getByTestId("account-menu-trigger")).toHaveCount(0);
  });

  test("authenticated routes live in the user menu and help stays out of the desktop account nav", () => {
    const navigationSource = readSource("src/components/AppNavigation.tsx");
    const navigationServiceSource = readSource("src/services/navigationService.ts");

    expect(navigationSource).toContain('data-testid="account-menu-trigger"');
    expect(navigationSource).toContain('data-testid="account-menu-panel"');
    expect(navigationSource).toContain("identity?.email");
    expect(navigationSource).toContain("accountNavigationItems.map");
    expect(navigationServiceSource).toContain('"dashboard"');
    expect(navigationServiceSource).toContain('"projects"');
    expect(navigationServiceSource).toContain('"exports"');
    expect(navigationServiceSource).toContain('"provider-settings"');
    expect(navigationServiceSource).toContain('"credits"');
    expect(navigationSource).toContain("account-menu-logout");
    expect(navigationSource).not.toContain("Account Settings");
    expect(navigationSource).not.toContain('navigateTo("/help")');
    expect(navigationSource).not.toContain("user_metadata");
    expect(navigationSource).not.toContain("app_metadata");
    expect(navigationSource).not.toContain("platform_admin");
  });

  test("footer removes private account links while keeping resources and legal links", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "load" });

    const footer = page.getByTestId("site-footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByRole("heading", { name: "Product", exact: true })).toBeVisible();
    await expect(footer.getByRole("heading", { name: "Explore", exact: true })).toBeVisible();
    await expect(footer.getByRole("heading", { name: "Resources", exact: true })).toBeVisible();
    await expect(footer.getByRole("heading", { name: "Legal", exact: true })).toBeVisible();
    await expect(footer.getByRole("heading", { name: "Account", exact: true })).toHaveCount(0);
    await expect(footer.getByRole("button", { name: "Dashboard", exact: true })).toHaveCount(0);
    await expect(footer.getByRole("button", { name: "Projects", exact: true })).toHaveCount(0);
    await expect(footer.getByRole("button", { name: "History", exact: true })).toHaveCount(0);
    await expect(footer.getByRole("button", { name: "Provider Settings", exact: true })).toHaveCount(0);
    await expect(footer.getByRole("button", { name: "Credits", exact: true })).toHaveCount(0);
    await expect(footer.getByRole("button", { name: "Help", exact: true })).toBeVisible();
    await expect(footer.getByRole("button", { name: "Onboarding", exact: true })).toBeVisible();
    await expect(footer.getByRole("button", { name: "Privacy", exact: true })).toBeVisible();
    await expect(footer.getByRole("button", { name: "Terms", exact: true })).toBeVisible();
  });

  test("navbar stays horizontally stable across public and protected route shells", async ({
    page,
  }) => {
    for (const viewport of viewportCases) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      for (const routePath of routeCases) {
        await test.step(`${viewport.name} ${routePath}`, async () => {
          await page.goto(routePath, { waitUntil: "load" });

          const hasHorizontalOverflow = await page.evaluate(() => {
            const root = document.documentElement;
            return root.scrollWidth > window.innerWidth + 1;
          });

          expect(hasHorizontalOverflow).toBe(false);
        });
      }
    }
  });

  test("phase54 keeps backend auth runtime and env files out of the UI polish", () => {
    const navigationSource = readSource("src/components/AppNavigation.tsx");
    const footerSource = readSource("src/components/AppFooter.tsx");
    const stylesSource = readSource("src/styles.css");
    const authRuntimeSource = readSource("src/services/auth/authRuntimeService.ts");
    const authServiceSource = readSource("src/services/authService.ts");

    expect(`${navigationSource}\n${footerSource}\n${stylesSource}`).not.toContain(
      "FREE_AI_MIXER_AUTH",
    );
    expect(`${navigationSource}\n${footerSource}\n${stylesSource}`).not.toContain(
      "VITE_SUPABASE",
    );
    expect(authRuntimeSource).toContain("loginWithSupabaseRuntime");
    expect(authServiceSource).toContain('const accountBootstrapEndpoint = "/account/bootstrap"');
  });
});
