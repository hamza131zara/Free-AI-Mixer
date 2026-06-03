import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const longEmail =
  "phase88.extremely.long.authenticated.browser.smoke.account@example-testing.invalid";
const rawProviderKey = "FAKE_PHASE88_OPENAI_KEY_DO_NOT_STORE";
const replacementProviderKey = "FAKE_PHASE88_OPENAI_REPLACEMENT_KEY_DO_NOT_STORE";

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
      summary: "OpenAI provider metadata for BYOK smoke regression.",
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

const emptyConnection = {
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
  maskedFingerprint: "provider-key:88stored",
  keyFingerprintSuffix: "88st",
  lastValidationStatus: "not_validated",
  verificationStatus: "not_validated",
  needsReverification: true,
  canManage: true,
};

const replacedConnection = {
  ...storedConnection,
  maskedFingerprint: "provider-key:88replaced",
  keyFingerprintSuffix: "88rp",
  maskedKeySummary: "Provider key replacement metadata is stored server-side only.",
};

const validatedConnection = {
  ...replacedConnection,
  lastVerifiedAt: "2026-06-03T00:00:00.000Z",
  lastValidationStatus: "validated",
  verificationStatus: "validated",
  needsReverification: false,
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

const expectNoBrowserPersistence = async (page: Page, forbidden: string) => {
  const browserState = await page.evaluate(() =>
    JSON.stringify({
      cookie: document.cookie,
      href: window.location.href,
      localStorage: { ...window.localStorage },
      search: window.location.search,
      sessionStorage: { ...window.sessionStorage },
      visibleText: document.body.innerText,
    }),
  );

  expect(browserState).not.toContain(forbidden);
};

const mockAuthenticatedProviderSettingsBackend = async (
  page: Page,
  options: { readMode?: "generic" | "active" } = {},
) => {
  const requests: Array<{ body: string | null; method: string; pathname: string }> = [];
  const getReadConnection = () =>
    options.readMode === "active" ? validatedConnection : emptyConnection;

  await page.route(routePath("/auth/session"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "authenticated_session",
        status: "authenticated",
        message: "Backend session verified.",
        identity: {
          userId: "phase88-user",
          appUserId: "phase88-user",
          supabaseUserId: "phase88-supabase-user",
          email: longEmail,
          workspaceId: "phase88-workspace",
          workspaceRole: "workspace_owner",
          workspaceAuthority: "verified",
          authProvider: "supabase",
          authSubject: "phase88-supabase-user",
        },
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
    const connection = getReadConnection();

    await route.fulfill(
      jsonResponse({
        kind: "provider_settings_status",
        status: "authenticated",
        message: "Provider settings are available for this verified session.",
        activeWorkspaceId: "phase88-workspace",
        routingPreferences: routingPolicyPayload.routingPreferences,
        connections: [connection],
      }),
    );
  });

  await page.route(routePath("/provider-settings/connections/openai/test"), async (route) => {
    const request = route.request();
    requests.push({
      body: request.postData(),
      method: request.method(),
      pathname: new URL(request.url()).pathname,
    });
    await route.fulfill(
      jsonResponse({
        kind: "provider_settings_connection_validation_result",
        status: "validated",
        message: "Provider key validation completed by local mock adapter.",
        connection: validatedConnection,
      }),
    );
  });

  await page.route(routePath("/provider-settings/connections/openai"), async (route) => {
    const request = route.request();

    requests.push({
      body: request.postData(),
      method: request.method(),
      pathname: new URL(request.url()).pathname,
    });

    if (request.method() === "PUT") {
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

    await route.fulfill(
      jsonResponse({
        kind: "provider_settings_connection_revoked",
        status: "revoked",
        message: "Provider key was revoked server-side.",
        connection: revokedConnection,
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
          connections: [getReadConnection()],
        }),
      );
      return;
    }

    requests.push({
      body: request.postData(),
      method: request.method(),
      pathname: new URL(request.url()).pathname,
    });
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

  return { requests };
};

const saveReplaceAndValidate = async (page: Page) => {
  const keyForm = page.getByTestId("provider-key-form");

  await page.getByTestId("provider-key-input").fill(rawProviderKey);
  await keyForm.getByRole("button", { name: "Save key", exact: true }).click();
  await expect(page.getByTestId("provider-key-input")).toHaveValue("");

  await page.getByTestId("provider-key-input").fill(replacementProviderKey);
  await keyForm.getByRole("button", { name: "Replace key", exact: true }).click();
  await expect(page.getByTestId("provider-key-input")).toHaveValue("");

  await keyForm.getByRole("button", { name: "Validate stored key", exact: true }).click();
  await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
    "Validated by backend",
  );
  await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
    "Verification status: validated",
  );
  await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
    "Needs reverification: no",
  );
};

test.describe("phase88 BYOK mock validation browser smoke fixes", () => {
  test("long email stays out of navbar trigger and appears inside dropdown only", async ({
    page,
  }) => {
    await mockAuthenticatedProviderSettingsBackend(page);
    await page.goto("/settings/providers", { waitUntil: "load" });

    const headerHeight = await page.locator(".site-header").boundingBox();
    const trigger = page.getByTestId("account-menu-trigger");

    await expect(trigger).toBeVisible();
    await expect(page.getByTestId("account-nav-identity")).toHaveText("Account");
    await expect(page.getByTestId("account-nav-identity")).not.toContainText(longEmail);
    expect((await page.locator(".site-header").boundingBox())?.height).toBe(
      headerHeight?.height,
    );

    await trigger.click();
    await expect(page.getByTestId("account-menu-identity")).toContainText(longEmail);
    expect((await page.locator(".site-header").boundingBox())?.height).toBe(
      headerHeight?.height,
    );
  });

  test("active stored key controls survive route navigation with stale generic refresh", async ({
    page,
  }) => {
    const backend = await mockAuthenticatedProviderSettingsBackend(page, {
      readMode: "generic",
    });
    await page.goto("/settings/providers", { waitUntil: "load" });

    await saveReplaceAndValidate(page);
    await page
      .getByLabel("Primary navigation")
      .getByRole("button", { name: "Mixer", exact: true })
      .click();
    await expect(page).toHaveURL(/\/mixer$/);
    await page.getByTestId("account-menu-trigger").click();
    await page.getByRole("button", { name: "Provider Settings", exact: true }).click();

    const keyForm = page.getByTestId("provider-key-form");
    await expect(keyForm.getByRole("button", { name: "Replace key", exact: true })).toBeVisible();
    await expect(keyForm.getByRole("button", { name: "Remove key", exact: true })).toBeEnabled();
    await expect(keyForm.getByRole("button", { name: "Validate stored key", exact: true })).toBeEnabled();
    await expect(
      keyForm.getByRole("button", { name: "Save key", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "Validated by backend",
    );

    await keyForm.getByRole("button", { name: "Remove key", exact: true }).click();

    await expect(page.getByTestId("provider-key-mutation-message")).toContainText(
      "Provider key was revoked server-side.",
    );
    await expect(keyForm.getByRole("button", { name: "Save key", exact: true })).toBeVisible();
    await expect(keyForm.getByRole("button", { name: "Remove key", exact: true })).toBeDisabled();
    await expect(
      keyForm.getByRole("button", { name: "Store key before validation", exact: true }),
    ).toBeDisabled();
    await expectNoBrowserPersistence(page, "FAKE_PHASE88");

    expect(backend.requests).toEqual([
      {
        body: JSON.stringify({ apiKey: rawProviderKey, providerId: "openai" }),
        method: "POST",
        pathname: "/provider-settings/connections",
      },
      {
        body: JSON.stringify({ apiKey: replacementProviderKey }),
        method: "PUT",
        pathname: "/provider-settings/connections/openai",
      },
      {
        body: null,
        method: "POST",
        pathname: "/provider-settings/connections/openai/test",
      },
      {
        body: null,
        method: "DELETE",
        pathname: "/provider-settings/connections/openai",
      },
    ]);
  });

  test("page restore can hydrate active stored key from backend redacted summary", async ({
    page,
  }) => {
    await mockAuthenticatedProviderSettingsBackend(page, { readMode: "active" });
    await page.goto("/settings/providers", { waitUntil: "load" });

    const keyForm = page.getByTestId("provider-key-form");
    await expect(keyForm.getByRole("button", { name: "Replace key", exact: true })).toBeVisible();
    await expect(keyForm.getByRole("button", { name: "Remove key", exact: true })).toBeEnabled();
    await expect(keyForm.getByRole("button", { name: "Validate stored key", exact: true })).toBeEnabled();
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "Validated by backend",
    );
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "provider-key:88replaced",
    );
  });

  test("source boundaries keep Phase 88 frontend-only and avoid fake provider success", () => {
    const navigationSource = readSource("src/components/AppNavigation.tsx");
    const pageSource = readSource("src/pages/ProviderSettingsPage.tsx");
    const storeSource = readSource("src/store/providerSettingsStore.ts");
    const serviceSource = readSource("src/services/providerSettingsService.ts");
    const packageJson = readSource("package.json");
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const billingService = readSource("src/services/billingService.ts");
    const generationService = readSource("src/services/sceneGenerationService.ts");
    const frontendBoundary = `${navigationSource}\n${pageSource}\n${storeSource}\n${serviceSource}`;

    expect(navigationSource).toContain("accountMenuTriggerCopy");
    expect(navigationSource).toContain("account-menu-identity");
    expect(storeSource).toContain("mergeRefreshedConnections");
    expect(storeSource).toContain("hasActiveManageableSummary");
    expect(serviceSource).toContain("/test");

    for (const forbidden of [
      "localStorage.setItem",
      "sessionStorage.setItem",
      "document.cookie",
      "api.openai.com",
      "replicate.com",
      "api.runway",
      "api.luma",
      "generativelanguage.googleapis.com",
      'fetch("https://',
      "fetch(`https://",
      "connected_success",
      "verified_success",
      "test_passed",
      "fake_success",
      "Test passed",
      "Verified provider",
      "Live provider ready",
      "Generation enabled",
    ]) {
      expect(frontendBoundary).not.toContain(forbidden);
      expect(packageJson).not.toContain(forbidden);
    }

    expect(`${creditsPage}\n${billingService}`).not.toMatch(
      /getFreeCredits|requestFreeCredits|get-free-credits|checkoutEnabled|recordLedger|mutateLedger/i,
    );
    expect(generationService).not.toContain("/provider-settings/connections");
  });
});
