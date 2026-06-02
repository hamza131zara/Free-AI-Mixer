import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const rawProviderKey = "FAKE_PHASE78_PROVIDER_KEY_DO_NOT_PERSIST";
const replacementProviderKey = "FAKE_PHASE78_REPLACEMENT_KEY_DO_NOT_PERSIST";
const longAccountEmail =
  "phase78.extremely.long.private.beta.tester.identity.with.many.segments@example.test";

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const jsonResponse = (payload: unknown, status = 200) => ({
  body: JSON.stringify(payload),
  contentType: "application/json",
  status,
});

const routePath = (pathname: string) => (url: URL): boolean =>
  url.pathname === pathname;

const providerCatalogPayload = {
  kind: "provider_catalog",
  message: "Supported providers are listed below.",
  providers: [
    {
      id: "openai",
      displayName: "OpenAI",
      capabilities: ["image_generation", "prompt_text_intelligence"],
      supportsByok: true,
      summary: "OpenAI provider metadata for BYOK testing.",
      officialWebsite: "https://example.invalid/openai",
      docsUrl: "https://example.invalid/openai/docs",
      securityNote: "Keys are sent only to the backend.",
      costNote: "Provider costs are billed by the provider.",
      platformLimitNote: "Free AI Mixer credits are separate.",
      status: "available",
    },
  ],
};

const routingPolicyPayload = {
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
};

const notConnectedConnection = {
  providerId: "openai",
  status: "not_connected",
  maskedKeySummary: "No stored key summary yet.",
  lastValidationStatus: "not_validated",
  verificationStatus: "not_validated",
  needsReverification: true,
  canManage: false,
};

const storedConnection = {
  providerId: "openai",
  status: "not_connected",
  maskedKeySummary: "Provider key metadata is stored server-side only.",
  maskedFingerprint: "provider-key:78stored",
  keyFingerprintSuffix: "78st",
  lastValidationStatus: "not_validated",
  verificationStatus: "not_validated",
  needsReverification: true,
  canManage: true,
};

const replacedConnection = {
  ...storedConnection,
  maskedFingerprint: "provider-key:78replaced",
  keyFingerprintSuffix: "78rp",
  maskedKeySummary: "Provider key replacement metadata is stored server-side only.",
};

const revokedConnection = {
  providerId: "openai",
  status: "not_connected",
  maskedKeySummary: "Provider key was revoked server-side.",
  lastValidationStatus: "not_validated",
  verificationStatus: "not_validated",
  needsReverification: true,
  canManage: true,
};

const mockAuthenticatedProviderSettingsBackend = async (page: Page) => {
  let currentConnection = notConnectedConnection;

  await page.route(routePath("/auth/session"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "authenticated_session",
        status: "authenticated",
        message: "Backend session verified.",
        identity: {
          userId: "phase78-user",
          appUserId: "phase78-user",
          supabaseUserId: "phase78-supabase-user",
          email: longAccountEmail,
          workspaceId: "phase78-workspace",
          workspaceRole: "workspace_owner",
          workspaceAuthority: "verified",
          authProvider: "supabase",
          authSubject: "phase78-supabase-user",
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
        activeWorkspaceId: "phase78-workspace",
        persistence: "not_enabled_yet",
        projects: [],
      }),
    );
  });

  await page.route(routePath("/provider-settings/catalog"), async (route) => {
    await route.fulfill(jsonResponse(providerCatalogPayload));
  });

  await page.route(routePath("/provider-settings/routing-policy"), async (route) => {
    await route.fulfill(jsonResponse(routingPolicyPayload));
  });

  await page.route(routePath("/provider-settings/status"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "provider_settings_status",
        status: "authenticated",
        message: "Provider settings are available for this verified session.",
        activeWorkspaceId: "phase78-workspace",
        routingPreferences: routingPolicyPayload.routingPreferences,
        connections: [currentConnection],
      }),
    );
  });

  await page.route(routePath("/provider-settings/connections"), async (route) => {
    const request = route.request();

    if (request.method() === "GET") {
      await route.fulfill(
        jsonResponse({
          kind: "provider_settings_connections",
          message: "Provider connection summaries are available.",
          connections: [currentConnection],
        }),
      );
      return;
    }

    currentConnection = storedConnection;
    await route.fulfill(
      jsonResponse(
        {
          kind: "provider_settings_connection_stored",
          status: "stored",
          message: "Provider key was stored server-side.",
          connection: storedConnection,
        },
        201,
      ),
    );
  });

  await page.route(routePath("/provider-settings/connections/openai"), async (route) => {
    const request = route.request();

    if (request.method() === "PUT") {
      currentConnection = replacedConnection;
      await route.fulfill(
        jsonResponse({
          kind: "provider_settings_connection_replaced",
          status: "replaced",
          message: "Provider key was replaced server-side.",
          connection: replacedConnection,
        }),
      );
      return;
    }

    currentConnection = revokedConnection;
    await route.fulfill(
      jsonResponse({
        kind: "provider_settings_connection_revoked",
        status: "revoked",
        message: "Provider key was revoked server-side.",
        connection: revokedConnection,
      }),
    );
  });
};

test.describe("phase78 BYOK frontend UX polish", () => {
  test("revoking a provider key returns controls to save mode without fake status", async ({
    page,
  }) => {
    await mockAuthenticatedProviderSettingsBackend(page);
    await page.goto("/settings/providers", { waitUntil: "load" });

    await expect(page.getByTestId("provider-key-input")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save key", exact: true })).toBeVisible();

    await page.getByTestId("provider-key-input").fill(rawProviderKey);
    await page.getByRole("button", { name: "Save key", exact: true }).click();
    await expect(page.getByTestId("provider-key-input")).toHaveValue("");
    await expect(
      page.getByTestId("provider-key-form").getByRole("button", { name: "Replace key", exact: true }),
    ).toBeVisible();

    await page.getByTestId("provider-key-input").fill(replacementProviderKey);
    await page
      .getByTestId("provider-key-form")
      .getByRole("button", { name: "Replace key", exact: true })
      .click();
    await expect(page.getByTestId("provider-key-input")).toHaveValue("");
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "provider-key:78replaced",
    );

    await page
      .getByTestId("provider-key-form")
      .getByRole("button", { name: "Remove key", exact: true })
      .click();

    await expect(page.getByTestId("provider-key-mutation-message")).toContainText(
      "Provider key was revoked server-side.",
    );
    await expect(page.getByRole("button", { name: "Save key", exact: true })).toBeVisible();
    await expect(
      page.getByTestId("provider-key-form").getByRole("button", { name: "Replace key", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("provider-key-form").getByRole("button", { name: "Remove key", exact: true }),
    ).toBeDisabled();
    await expect(page.getByRole("button", { name: "Test connection unavailable", exact: true })).toBeDisabled();
    await expect(page.getByText(/test passed|verified_success|connected_success/i)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(rawProviderKey);
    await expect(page.locator("body")).not.toContainText(replacementProviderKey);
  });

  test("account menu closes on navigation and long identity stays clipped", async ({
    page,
  }) => {
    await mockAuthenticatedProviderSettingsBackend(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard", { waitUntil: "load" });

    const header = page.locator(".site-header");
    await expect(page.getByTestId("account-menu-trigger")).toBeVisible();
    await expect(page.getByTestId("account-nav-identity")).toHaveText(longAccountEmail);

    const headerHeight = await header.evaluate((element) => element.getBoundingClientRect().height);
    const identityClipped = await page.getByTestId("account-nav-identity").evaluate((element) => {
      return element.scrollWidth > element.clientWidth + 1;
    });

    expect(headerHeight).toBeLessThanOrEqual(96);
    expect(identityClipped).toBe(true);

    await page.getByTestId("account-menu-trigger").click();
    await expect(page.getByTestId("account-menu-panel")).toBeVisible();
    await page.getByTestId("account-menu-panel").getByRole("button", { name: "Projects", exact: true }).click();
    await expect(page.getByTestId("projects-page")).toBeVisible();

    await expect(page.getByTestId("account-menu-trigger")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(page.getByTestId("account-menu-panel")).toHaveCount(0);
  });

  test("source boundaries keep polish frontend-only and non-live", () => {
    const navigationSource = readSource("src/components/AppNavigation.tsx");
    const pageSource = readSource("src/pages/ProviderSettingsPage.tsx");
    const storeSource = readSource("src/store/providerSettingsStore.ts");
    const stylesSource = readSource("src/styles.css");
    const packageJson = readSource("package.json");
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const billingService = readSource("src/services/billingService.ts");
    const changedFrontendBoundary = `${navigationSource}\n${pageSource}\n${storeSource}\n${stylesSource}`;

    expect(storeSource).toContain('result.status === "revoked"');
    expect(navigationSource).toContain("accountMenuOpen");
    expect(navigationSource).toContain("closeAccountMenu");
    expect(stylesSource).toContain("text-overflow: ellipsis");
    expect(stylesSource).toContain("max-width: 18ch");

    for (const forbidden of [
      "api.openai.com",
      "replicate.com",
      "api.runway",
      "api.luma",
      "generativelanguage.googleapis.com",
      'fetch("https://',
      "fetch(`https://",
      "connected_success",
      "verified_success",
      "verification_success",
      "test_passed",
      "fake_success",
      "localStorage.setItem",
      "sessionStorage.setItem",
      "document.cookie",
    ]) {
      expect(changedFrontendBoundary).not.toContain(forbidden);
    }

    expect(packageJson).not.toContain("@openai/");
    expect(packageJson).not.toContain("@replicate/");
    expect(packageJson).not.toContain("@runway");
    expect(packageJson).not.toContain("@luma");
    expect(`${creditsPage}\n${billingService}`).not.toMatch(
      /getFreeCredits|requestFreeCredits|get-free-credits|checkoutEnabled|recordLedger|mutateLedger/i,
    );
  });
});
