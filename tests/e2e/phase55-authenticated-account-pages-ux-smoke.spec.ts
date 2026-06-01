import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const accountPageCases = [
  { path: "/dashboard", testId: "dashboard-page" },
  { path: "/projects", testId: "projects-page" },
  { path: "/history", testId: "export-history-page" },
  { path: "/settings/providers", testId: "provider-settings-page" },
  { path: "/credits", testId: "credits-page" },
] as const;

const viewportCases = [
  { height: 900, name: "desktop", width: 1440 },
  { height: 820, name: "tablet", width: 900 },
  { height: 844, name: "mobile", width: 390 },
] as const;

const jsonResponse = (payload: unknown, status = 200) => ({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });

const routePath = (pathname: string) => (url: URL): boolean =>
  url.pathname === pathname;

const mockAuthenticatedAccountBackend = async (page: Page): Promise<void> => {
  await page.route(routePath("/auth/session"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "authenticated_session",
        status: "authenticated",
        message: "Backend session verified.",
        identity: {
          userId: "phase55-user",
          appUserId: "phase55-user",
          supabaseUserId: "phase55-supabase-user",
          email: "phase55.tester@example.test",
          workspaceId: "phase55-workspace",
          workspaceRole: "workspace_owner",
          workspaceAuthority: "verified",
          authProvider: "supabase",
          authSubject: "phase55-supabase-user",
        },
      }),
    );
  });

  await page.route(routePath("/auth/logout"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "logged_out",
        status: "unauthenticated",
        message: "Backend session cleared.",
      }),
    );
  });

  await page.route(routePath("/project-library/projects"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "project_library",
        status: "authenticated",
        message:
          "Project library is available for this verified session, but durable saved projects are not enabled yet.",
        activeWorkspaceId: "phase55-workspace",
        persistence: "not_enabled_yet",
        projects: [],
      }),
    );
  });

  await page.route(routePath("/project-library/history"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "export_history",
        status: "authenticated",
        message:
          "Export history is available for this verified session, but durable account-linked history is not enabled yet.",
        activeWorkspaceId: "phase55-workspace",
        historyState: "not_enabled_yet",
        exports: [],
      }),
    );
  });

  await page.route(routePath("/provider-settings/catalog"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "provider_catalog",
        message: "Supported providers are listed below.",
        providers: [],
      }),
    );
  });

  await page.route(routePath("/provider-settings/routing-policy"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "provider_settings_routing_policy",
        message:
          "Routing policy stays metadata-only until secure provider connection storage and runtime execution are ready.",
        routingPreferences: {
          mode: "auto",
          recommendedVideoPriority: ["runway", "luma", "google", "openai", "replicate"],
          recommendedImagePriority: ["openai", "stability", "google", "replicate"],
          fallback: {
            enabled: false,
            orderedProviderIds: [],
            requiresExplicitOptIn: true,
          },
        },
      }),
    );
  });

  await page.route(routePath("/provider-settings/connections"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "provider_settings_connections",
        message:
          "Provider connection summaries remain metadata-only until secure backend key storage is implemented.",
        connections: [],
      }),
    );
  });

  await page.route(routePath("/provider-settings/status"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "provider_settings_status",
        status: "authenticated",
        message: "Provider settings are available for this verified session.",
        activeWorkspaceId: "phase55-workspace",
        routingPreferences: {
          mode: "auto",
          recommendedVideoPriority: ["runway", "luma", "google", "openai", "replicate"],
          recommendedImagePriority: ["openai", "stability", "google", "replicate"],
          fallback: {
            enabled: false,
            orderedProviderIds: [],
            requiresExplicitOptIn: true,
          },
        },
        connections: [],
      }),
    );
  });

  await page.route(routePath("/credits/policy"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "credits_policy",
        message: "Credit policy is available in planned-state form only.",
        policy: {
          freeByokDailyCreditsLater: 2500,
          providerCostOwner: "user_api_key",
          walletScope: "workspace",
          sharedWalletSurfaces: ["mixer", "templates", "exports", "downloads"],
          multipleApiKeysMultiplyCredits: false,
          multipleProvidersMultiplyCredits: false,
          creditsEnabled: false,
          billingEnabled: false,
          policyNotes: ["Credits and billing are not enabled yet."],
          draftEstimates: [],
        },
      }),
    );
  });

  await page.route(routePath("/credits/status"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "credits_status",
        status: "authenticated",
        message:
          "Credits policy is visible for this verified session, but wallet mutation is not enabled yet.",
        wallet: {
          state: "not_enabled_yet",
          scope: "workspace",
          liveBalanceAvailable: false,
          activeWorkspaceId: "phase55-workspace",
          message: "No live credit balance, ledger, or remaining-credit value is shown in this phase.",
        },
      }),
    );
  });
};

const assertNoHorizontalOverflow = async (page: Page): Promise<void> => {
  const hasHorizontalOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > window.innerWidth + 1;
  });

  expect(hasHorizontalOverflow).toBe(false);
};

const gotoAccountPage = async (page: Page, pathname: string): Promise<void> => {
  if (pathname !== "/credits") {
    await page.goto(pathname, { waitUntil: "load" });
    return;
  }

  await page.goto("/dashboard", { waitUntil: "load" });
  await expect(page.getByTestId("dashboard-page")).toBeVisible();
  const isMobile = await page.evaluate(() => window.innerWidth <= 860);

  if (isMobile) {
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await page
      .getByTestId("mobile-nav-groups")
      .getByRole("button", { name: "Credits", exact: true })
      .click();
  } else {
    await page.getByTestId("account-menu-trigger").click();
    await page
      .getByTestId("account-menu-panel")
      .getByRole("button", { name: "Credits", exact: true })
      .click();
  }

  await expect(page).toHaveURL(/\/credits$/);
};

test.describe("phase55 authenticated account pages ux smoke", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedAccountBackend(page);
  });

  test("dashboard shows backend-authenticated session and stable account menu", async ({
    page,
  }) => {
    await page.goto("/dashboard", { waitUntil: "load" });

    await expect(page.getByTestId("dashboard-page")).toBeVisible();
    await expect(page.getByTestId("dashboard-session-state")).toContainText("authenticated");
    await expect(page.getByTestId("dashboard-session-state")).not.toContainText(
      "invalid_credentials",
    );
    await expect(page.getByTestId("dashboard-account-status-panel")).toContainText(
      "phase55.tester@example.test",
    );
    await expect(page.getByTestId("dashboard-account-status-panel")).toContainText(
      "Workspace authority verified by backend membership.",
    );

    const trigger = page.getByTestId("account-menu-trigger");
    await expect(trigger).toBeVisible();
    await trigger.click();
    const menu = page.getByTestId("account-menu-panel");
    for (const label of [
      "Dashboard",
      "Projects",
      "History",
      "Provider Settings",
      "Credits",
      "Log out",
    ]) {
      await expect(menu.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
    await expect(menu.getByRole("button", { name: "Account Settings", exact: true })).toHaveCount(0);
  });

  test("projects and history remain authenticated but empty without fake private data", async ({
    page,
  }) => {
    await page.goto("/projects", { waitUntil: "load" });
    await expect(page.getByTestId("projects-access-state")).toContainText("authenticated");
    await expect(page.getByTestId("projects-empty-state")).toContainText(
      "Saved projects are not enabled yet",
    );
    await expect(page.getByText(/fake project cards|fake timestamps|fake cloud persistence/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Project 1|Sample Project|Demo Project/i })).toHaveCount(0);

    await page.goto("/history", { waitUntil: "load" });
    await expect(page.getByTestId("history-access-state")).toContainText("authenticated");
    await expect(page.getByTestId("history-empty-state")).toContainText(
      "Export history is not enabled yet",
    );
    await expect(page.getByText(/No fake export records/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /download/i })).toHaveCount(0);
    await expect(page.getByText(/signed url|artifact ready|download ready/i)).toHaveCount(0);
  });

  test("provider settings remains BYOK readiness-only and non-live", async ({ page }) => {
    await page.goto("/settings/providers", { waitUntil: "load" });

    await expect(page.getByTestId("provider-settings-page")).toBeVisible();
    await expect(page.getByTestId("provider-settings-access-state")).toContainText(
      "authenticated",
    );
    await expect(page.getByText("Provider key setup is not enabled in this beta.")).toBeVisible();
    await expect(page.getByTestId("provider-connection-empty-state")).toContainText(
      "Secure API key connection is not enabled yet.",
    );
    for (const label of ["Add key", "Replace key", "Remove key", "Test connection"]) {
      await expect(page.getByRole("button", { name: label, exact: true })).toHaveCount(0);
    }
    await expect(page.locator('input[type="password"], input[name*="key" i]')).toHaveCount(0);
    await expect(page.getByText(/Provider connected|API key connected|Verified connection/i)).toHaveCount(0);
  });

  test("credits remains planning-only without wallet billing or ledger mutation", async ({
    page,
  }) => {
    await gotoAccountPage(page, "/credits");

    await expect(page.getByTestId("credits-page")).toBeVisible();
    await expect(page.getByTestId("credits-status-card")).toContainText("authenticated");
    await expect(page.getByText("Credits are planning-only in this beta.")).toBeVisible();
    await expect(page.getByText("No live credit balance, ledger, or remaining-credit value")).toBeVisible();
    await expect(page.getByText("Credits and billing are not enabled yet.")).toBeVisible();
    await expect(page.getByRole("button", { name: /checkout|subscribe|refill|buy credits/i })).toHaveCount(0);
    await expect(page.getByText(/current balance|remaining credits|subscription active|ledger entry/i)).toHaveCount(0);
  });

  test("footer keeps private account links out and public pages stay unaffected", async ({
    page,
  }) => {
    await page.goto("/dashboard", { waitUntil: "load" });

    const footer = page.getByTestId("site-footer");
    await expect(footer.getByRole("heading", { name: "Account", exact: true })).toHaveCount(0);
    await expect(footer.getByRole("button", { name: "Dashboard", exact: true })).toHaveCount(0);
    await expect(footer.getByRole("button", { name: "Projects", exact: true })).toHaveCount(0);
    await expect(footer.getByRole("button", { name: "History", exact: true })).toHaveCount(0);
    await expect(footer.getByRole("button", { name: "Provider Settings", exact: true })).toHaveCount(0);
    await expect(footer.getByRole("button", { name: "Credits", exact: true })).toHaveCount(0);
    await expect(footer.getByRole("button", { name: "Help", exact: true })).toBeVisible();
    await expect(footer.getByRole("button", { name: "Privacy", exact: true })).toBeVisible();

    await page.goto("/mixer", { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: "Free AI Mixer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Scene" })).toBeVisible();
  });

  test("account pages avoid horizontal overflow at desktop tablet and mobile widths", async ({
    page,
  }) => {
    for (const viewport of viewportCases) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      for (const routeCase of accountPageCases) {
        await test.step(`${viewport.name} ${routeCase.path}`, async () => {
          await gotoAccountPage(page, routeCase.path);
          await expect(page.getByTestId(routeCase.testId)).toBeVisible();
          await assertNoHorizontalOverflow(page);
        });
      }
    }
  });

  test("phase55 does not change backend auth env supabase runtime sources", () => {
    const backendAppSource = readSource("backend/app.ts");
    const authRuntimeSource = readSource("src/services/auth/authRuntimeService.ts");
    const supabaseClientSource = readSource("src/services/auth/supabaseAuthClient.ts");
    const navigationSource = readSource("src/components/AppNavigation.tsx");

    expect(backendAppSource).toContain("createAuthRouter");
    expect(authRuntimeSource).toContain("loginWithSupabaseRuntime");
    expect(supabaseClientSource).toContain("getSupabaseAuthClient");
    expect(navigationSource).toContain("account-menu-trigger");
    expect(navigationSource).not.toContain("user_metadata");
    expect(navigationSource).not.toContain("app_metadata");
    expect(navigationSource).not.toContain("platform_admin");
  });
});
