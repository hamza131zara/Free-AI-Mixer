import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const rawProviderKey = "FAKE_PHASE79_OPENAI_KEY_DO_NOT_STORE";
const replacementProviderKey = "FAKE_PHASE79_OPENAI_REPLACEMENT_KEY_DO_NOT_STORE";

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
  maskedFingerprint: "provider-key:79stored",
  keyFingerprintSuffix: "79st",
  lastValidationStatus: "not_validated",
  verificationStatus: "not_validated",
  needsReverification: true,
  canManage: true,
};

const replacedConnection = {
  ...storedConnection,
  maskedFingerprint: "provider-key:79replaced",
  keyFingerprintSuffix: "79rp",
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

const mockAuthenticatedByokBackend = async (page: Page) => {
  const requests: Array<{ body?: unknown; method: string; pathname: string }> = [];
  let currentConnection = notConnectedConnection;

  await page.route(routePath("/auth/session"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "authenticated_session",
        status: "authenticated",
        message: "Backend session verified.",
        identity: {
          userId: "phase79-user",
          appUserId: "phase79-user",
          supabaseUserId: "phase79-supabase-user",
          email: "phase79.tester@example.test",
          workspaceId: "phase79-workspace",
          workspaceRole: "workspace_owner",
          workspaceAuthority: "verified",
          authProvider: "supabase",
          authSubject: "phase79-supabase-user",
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
    await route.fulfill(
      jsonResponse({
        kind: "provider_settings_status",
        status: "authenticated",
        message: "Provider settings are available for this verified session.",
        activeWorkspaceId: "phase79-workspace",
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

    requests.push({
      body: request.postDataJSON(),
      method: request.method(),
      pathname: new URL(request.url()).pathname,
    });
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

    requests.push({
      body: request.method() === "PUT" ? request.postDataJSON() : undefined,
      method: request.method(),
      pathname: new URL(request.url()).pathname,
    });

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

  return { requests };
};

test.describe("phase79 BYOK local browser smoke regression", () => {
  test("mocked browser smoke covers save replace remove without browser key persistence", async ({
    page,
  }) => {
    const backend = await mockAuthenticatedByokBackend(page);
    await page.goto("/settings/providers", { waitUntil: "load" });

    await expect(page.getByTestId("provider-settings-page")).toBeVisible();
    await expect(page.getByTestId("provider-settings-access-state")).toContainText("authenticated");
    await expect(page.getByTestId("provider-key-provider-select")).toBeVisible();
    await expect(page.getByTestId("provider-key-provider-select")).toHaveValue("openai");
    await expect(page.getByTestId("provider-key-input")).toHaveAttribute("type", "password");
    await expect(page.getByTestId("provider-key-input")).toHaveAttribute("autocomplete", "off");

    await page.getByTestId("provider-key-input").fill(rawProviderKey);
    await page.getByTestId("provider-key-form").getByRole("button", { name: "Save key", exact: true }).click();

    await expect(page.getByTestId("provider-key-input")).toHaveValue("");
    await expect(page.getByTestId("provider-key-mutation-message")).toContainText(
      "Provider key was stored server-side.",
    );
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "Stored server-side, not validated yet.",
    );
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "provider-key:79stored",
    );
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "Verification status: not_validated",
    );
    await expect(page.locator("body")).not.toContainText(rawProviderKey);
    await expectNoBrowserPersistence(page, rawProviderKey);

    await page.getByTestId("provider-key-input").fill(replacementProviderKey);
    await page.getByTestId("provider-key-form").getByRole("button", { name: "Replace key", exact: true }).click();

    await expect(page.getByTestId("provider-key-input")).toHaveValue("");
    await expect(page.getByTestId("provider-key-mutation-message")).toContainText(
      "Provider key was replaced server-side.",
    );
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "provider-key:79replaced",
    );
    await expect(page.locator("body")).not.toContainText(replacementProviderKey);
    await expectNoBrowserPersistence(page, replacementProviderKey);

    await page.getByTestId("provider-key-form").getByRole("button", { name: "Remove key", exact: true }).click();

    await expect(page.getByTestId("provider-key-mutation-message")).toContainText(
      "Provider key was revoked server-side.",
    );
    await expect(page.getByTestId("provider-key-form").getByRole("button", { name: "Save key", exact: true })).toBeVisible();
    await expect(page.getByTestId("provider-key-form").getByRole("button", { name: "Replace key", exact: true })).toHaveCount(0);
    await expect(page.getByTestId("provider-key-form").getByRole("button", { name: "Remove key", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Test connection unavailable", exact: true })).toBeDisabled();
    await expect(page.getByText(/test passed|verified_success|connected_success|connected provider/i)).toHaveCount(0);

    expect(backend.requests).toEqual([
      {
        body: { apiKey: rawProviderKey, providerId: "openai" },
        method: "POST",
        pathname: "/provider-settings/connections",
      },
      {
        body: { apiKey: replacementProviderKey },
        method: "PUT",
        pathname: "/provider-settings/connections/openai",
      },
      {
        body: undefined,
        method: "DELETE",
        pathname: "/provider-settings/connections/openai",
      },
    ]);
  });

  test("runbook records local fake-key smoke without secret-selecting instructions", () => {
    const runbook = readSource("docs/byok-local-browser-smoke-runbook.md");
    const normalizedRunbook = runbook.toLowerCase();

    expect(runbook).toContain("local/staging-only browser smoke");
    expect(runbook).toContain("FAKE_PHASE79_OPENAI_KEY_DO_NOT_STORE");
    expect(runbook).toContain("FAKE_PHASE79_OPENAI_REPLACEMENT_KEY_DO_NOT_STORE");
    expect(runbook).toContain("supabase start");
    expect(runbook).toContain("npm.cmd run dev -- --host 127.0.0.1 --port 5173");
    expect(runbook).toContain("FREE_AI_MIXER_BYOK_PROVIDER_KEYS_RUNTIME_ENABLED");
    expect(runbook).toContain("VITE_SUPABASE_URL");
    expect(runbook).toContain("VITE_SUPABASE_ANON_KEY");
    expect(runbook).toContain("encrypted_payload is not null as has_encrypted_payload");
    expect(runbook).toContain("secret_ref is not null as has_secret_ref");
    expect(runbook).toContain("Test connection remains disabled");
    expect(runbook).toContain("Provider SDK/API calls.");
    expect(normalizedRunbook).toContain("never production");
    expect(normalizedRunbook).toContain("do not select `encrypted_payload` or `secret_ref` values");

    for (const forbidden of [
      "select encrypted_payload",
      "select secret_ref",
      "sk-",
      "service_role=",
      "jwt secret",
      "smtp password",
      "provider api key",
      "test connection implementation",
    ]) {
      expect(normalizedRunbook).not.toContain(forbidden);
    }
  });

  test("source remains free of provider SDK calls fake status and unrelated runtime expansion", () => {
    const pageSource = readSource("src/pages/ProviderSettingsPage.tsx");
    const serviceSource = readSource("src/services/providerSettingsService.ts");
    const storeSource = readSource("src/store/providerSettingsStore.ts");
    const authenticatedFetchSource = readSource("src/services/auth/authenticatedFetch.ts");
    const packageJson = readSource("package.json");
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const billingService = readSource("src/services/billingService.ts");
    const frontendByokBoundary = `${pageSource}\n${serviceSource}\n${storeSource}\n${authenticatedFetchSource}`;

    expect(pageSource).toContain("Test connection unavailable");
    expect(serviceSource).toContain("/provider-settings/connections");
    expect(storeSource).toContain('result.status === "revoked"');
    expect(authenticatedFetchSource).toContain("/provider-settings/connections");

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
      "verification_success",
      "test_passed",
      "fake_success",
    ]) {
      expect(frontendByokBoundary).not.toContain(forbidden);
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
