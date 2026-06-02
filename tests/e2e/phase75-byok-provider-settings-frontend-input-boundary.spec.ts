import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createAuthenticatedFetch } from "../../src/services/auth/authenticatedFetch";

const projectRoot = process.cwd();
const rawProviderKey = "FAKE_PHASE75_PROVIDER_KEY_DO_NOT_PERSIST";
const replacementProviderKey = "FAKE_PHASE75_REPLACEMENT_KEY_DO_NOT_PERSIST";

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
  maskedFingerprint: "provider-key:75stored",
  keyFingerprintSuffix: "75st",
  lastValidationStatus: "not_validated",
  verificationStatus: "not_validated",
  needsReverification: true,
  canManage: true,
};

const replacedConnection = {
  ...storedConnection,
  maskedFingerprint: "provider-key:75replaced",
  keyFingerprintSuffix: "75rp",
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
  const requests: Array<{ body?: unknown; headers: Record<string, string>; method: string; pathname: string }> = [];
  let currentConnection = notConnectedConnection;

  await page.route(routePath("/auth/session"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "authenticated_session",
        status: "authenticated",
        message: "Backend session verified.",
        identity: {
          userId: "phase75-user",
          appUserId: "phase75-user",
          supabaseUserId: "phase75-supabase-user",
          email: "phase75.tester@example.test",
          workspaceId: "phase75-workspace",
          workspaceRole: "workspace_owner",
          workspaceAuthority: "verified",
          authProvider: "supabase",
          authSubject: "phase75-supabase-user",
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
        activeWorkspaceId: "phase75-workspace",
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

    const body = request.postDataJSON();
    requests.push({
      body,
      headers: request.headers(),
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
    const method = request.method();
    const body = method === "PUT" ? request.postDataJSON() : undefined;
    requests.push({
      body,
      headers: request.headers(),
      method,
      pathname: new URL(request.url()).pathname,
    });

    if (method === "PUT") {
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

test.describe("phase75 BYOK provider settings frontend input boundary", () => {
  test("provider settings renders gated input and save replace revoke stay redacted", async ({
    page,
  }) => {
    const backend = await mockAuthenticatedProviderSettingsBackend(page);
    await page.goto("/settings/providers", { waitUntil: "load" });

    await expect(page.getByTestId("provider-settings-page")).toBeVisible();
    await expect(page.getByTestId("provider-key-provider-select")).toBeVisible();
    await expect(page.getByTestId("provider-key-input")).toHaveAttribute(
      "type",
      "password",
    );
    await expect(page.getByTestId("provider-key-input")).toHaveAttribute(
      "autocomplete",
      "off",
    );
    await expect(page.getByText("The key is sent only to the backend")).toBeVisible();
    await expect(page.getByText("not stored in the browser")).toBeVisible();
    await expect(page.getByText("encrypted server-side")).toBeVisible();
    await expect(page.getByTestId("provider-key-form-card")).toContainText(
      "Provider validation is not enabled yet",
    );

    await page.getByTestId("provider-key-input").fill(rawProviderKey);
    await page.getByRole("button", { name: "Save key", exact: true }).click();

    await expect(page.getByTestId("provider-key-input")).toHaveValue("");
    await expect(page.getByTestId("provider-key-mutation-message")).toContainText(
      "Provider key was stored server-side.",
    );
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "Stored server-side, not validated yet.",
    );
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "provider-key:75stored",
    );
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "75st",
    );
    await expect(page.locator("body")).not.toContainText(rawProviderKey);
    await expectNoBrowserPersistence(page, rawProviderKey);
    expect(backend.requests[0]).toMatchObject({
      body: { apiKey: rawProviderKey, providerId: "openai" },
      method: "POST",
      pathname: "/provider-settings/connections",
    });

    await page.getByTestId("provider-key-input").fill(replacementProviderKey);
    await page
      .getByTestId("provider-key-form")
      .getByRole("button", { name: "Replace key", exact: true })
      .click();

    await expect(page.getByTestId("provider-key-input")).toHaveValue("");
    await expect(page.getByTestId("provider-key-mutation-message")).toContainText(
      "Provider key was replaced server-side.",
    );
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "provider-key:75replaced",
    );
    await expect(page.locator("body")).not.toContainText(replacementProviderKey);
    await expectNoBrowserPersistence(page, replacementProviderKey);
    expect(backend.requests[1]).toMatchObject({
      body: { apiKey: replacementProviderKey },
      method: "PUT",
      pathname: "/provider-settings/connections/openai",
    });

    await page
      .getByTestId("provider-key-form")
      .getByRole("button", { name: "Remove key", exact: true })
      .click();

    await expect(page.getByTestId("provider-key-mutation-message")).toContainText(
      "Provider key was revoked server-side.",
    );
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "Provider key was revoked server-side.",
    );
    expect(backend.requests[2]).toMatchObject({
      method: "DELETE",
      pathname: "/provider-settings/connections/openai",
    });

    await expect(
      page.getByRole("button", { name: "Test connection unavailable", exact: true }),
    ).toBeDisabled();
    await expect(page.getByText(/test passed|verified_success|connected_success/i)).toHaveCount(0);
  });

  test("provider key input is hidden outside authenticated manageable provider state", async ({
    page,
  }) => {
    await page.route(routePath("/auth/session"), async (route) => {
      await route.fulfill(
        jsonResponse({
          kind: "unauthenticated_session",
          status: "unauthenticated",
          message: "Sign in required.",
        }),
      );
    });
    await page.route(routePath("/provider-settings/catalog"), async (route) => {
      await route.fulfill(jsonResponse(providerCatalogPayload));
    });
    await page.route(routePath("/provider-settings/routing-policy"), async (route) => {
      await route.fulfill(jsonResponse(routingPolicyPayload));
    });
    await page.route(routePath("/provider-settings/connections"), async (route) => {
      await route.fulfill(
        jsonResponse({
          kind: "provider_settings_connections",
          message: "Provider connection summaries are read-only.",
          connections: [],
        }),
      );
    });
    await page.route(routePath("/provider-settings/status"), async (route) => {
      await route.fulfill(
        jsonResponse({
          kind: "provider_settings_sign_in_required",
          status: "unauthenticated",
          reason: "missing_credentials",
          message: "Sign in is required before provider settings can be managed.",
        },
        401),
      );
    });

    await page.goto("/settings/providers", { waitUntil: "load" });

    await expect(page.getByRole("heading", { name: "Provider Settings" })).toBeVisible();
    await expect(
      page.getByText("Sign in is required before this page can show verified account data.").first(),
    ).toBeVisible();
    await expect(page.getByTestId("provider-key-form-card")).toHaveCount(0);
    await expect(page.getByTestId("provider-key-input")).toHaveCount(0);
  });

  test("authenticated fetch attaches bearer only to same-origin provider mutation routes", async () => {
    const calls: Array<{ headers: Record<string, string>; input: string }> = [];
    const authFetch = createAuthenticatedFetch({
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        calls.push({
          headers: Object.fromEntries(headers.entries()),
          input: String(input),
        });
        return new Response("{}", { status: 200 });
      },
      getSupabaseAuthClient: () => ({
        auth: {
          getAccessToken: async () => ({
            data: "phase75-bearer-token",
            ok: true,
          }),
        },
        kind: "supabase_auth_client_ready",
      }),
    });

    await authFetch("/provider-settings/connections", { method: "POST" });
    await authFetch("/provider-settings/connections/openai", { method: "PUT" });
    await authFetch("/provider-settings/connections/openai", { method: "DELETE" });
    await authFetch("/provider-settings/connections/openai/test", { method: "POST" });

    expect(calls[0].headers.authorization).toBe("Bearer phase75-bearer-token");
    expect(calls[1].headers.authorization).toBe("Bearer phase75-bearer-token");
    expect(calls[2].headers.authorization).toBe("Bearer phase75-bearer-token");
    expect(calls[3].headers.authorization).toBeUndefined();
  });

  test("source boundaries avoid key persistence provider SDKs fake status and unrelated runtime expansion", () => {
    const pageSource = readSource("src/pages/ProviderSettingsPage.tsx");
    const storeSource = readSource("src/store/providerSettingsStore.ts");
    const serviceSource = readSource("src/services/providerSettingsService.ts");
    const authenticatedFetchSource = readSource("src/services/auth/authenticatedFetch.ts");
    const packageJson = readSource("package.json");
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const billingService = readSource("src/services/billingService.ts");
    const frontendProviderSettings = `${pageSource}\n${storeSource}\n${serviceSource}`;

    expect(storeSource).not.toMatch(/apiKey\s*:\s*["'`]/);
    expect(storeSource).not.toContain("apiKey: undefined");
    expect(storeSource).not.toContain("localStorage");
    expect(storeSource).not.toContain("sessionStorage");
    expect(storeSource).not.toContain("document.cookie");
    expect(serviceSource).toContain("/provider-settings/connections");
    expect(authenticatedFetchSource).toContain("/provider-settings/connections");

    for (const forbidden of [
      "localStorage.setItem",
      "localStorage.getItem",
      "sessionStorage.setItem",
      "sessionStorage.getItem",
      "document.cookie",
      "persist(",
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
      expect(frontendProviderSettings).not.toContain(forbidden);
    }

    expect(packageJson).not.toContain("@openai/");
    expect(packageJson).not.toContain("@replicate/");
    expect(packageJson).not.toContain("@runway");
    expect(packageJson).not.toContain("@luma");
    expect(packageJson).not.toContain("stripe");
    expect(`${creditsPage}\n${billingService}`).toContain(
      "Credits and billing are not enabled yet.",
    );
    expect(`${creditsPage}\n${billingService}`).not.toMatch(
      /getFreeCredits|requestFreeCredits|get-free-credits|checkoutEnabled|recordLedger|mutateLedger/i,
    );
  });
});
