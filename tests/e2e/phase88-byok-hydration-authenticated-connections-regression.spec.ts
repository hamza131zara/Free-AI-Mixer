import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createAuthenticatedFetch } from "../../src/services/auth/authenticatedFetch";

const projectRoot = process.cwd();
const rawProviderKey = "FAKE_PHASE88_FIX4_KEY_DO_NOT_STORE";

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const jsonResponse = (payload: unknown, status = 200) => ({
  body: JSON.stringify(payload),
  contentType: "application/json",
  status,
});

const routePath = (pathname: string) => (url: URL): boolean =>
  url.pathname === pathname;

const routingPreferences = {
  mode: "auto",
  recommendedVideoPriority: ["runway", "luma", "google", "openai", "replicate"],
  recommendedImagePriority: ["openai", "stability", "google", "replicate"],
  fallback: {
    enabled: false,
    orderedProviderIds: [],
    requiresExplicitOptIn: true,
  },
};

const providerCatalogPayload = {
  kind: "provider_catalog",
  message: "Supported providers are listed below.",
  providers: [
    {
      id: "openai",
      displayName: "OpenAI",
      capabilities: ["image_generation", "prompt_text_intelligence"],
      supportsByok: true,
      summary: "OpenAI provider metadata for BYOK hydration regression.",
      officialWebsite: "https://example.invalid/openai",
      docsUrl: "https://example.invalid/openai/docs",
      securityNote: "Keys are sent only to the backend.",
      costNote: "Provider costs are billed by the provider.",
      platformLimitNote: "Free AI Mixer credits are separate.",
      status: "available",
    },
  ],
};

const activeStoredConnection = {
  providerId: "openai",
  status: "stored",
  maskedKeySummary: "Provider key metadata is stored server-side only.",
  maskedFingerprint: "provider-key:fix4",
  keyFingerprintSuffix: "fix4",
  createdAt: "2026-06-03T00:00:00.000Z",
  updatedAt: "2026-06-03T00:00:00.000Z",
  lastVerifiedAt: "2026-06-03T00:00:00.000Z",
  lastValidationStatus: "validated",
  verificationStatus: "validated",
  needsReverification: false,
  canManage: true,
};

const genericNotConnectedConnection = {
  providerId: "openai",
  status: "not_connected",
  maskedKeySummary: "Secure provider key storage is not enabled yet.",
  lastValidationStatus: "not_enabled_yet",
  verificationStatus: "not_enabled_yet",
  needsReverification: false,
  canManage: false,
  unavailableReason: "secure_provider_key_storage_not_enabled",
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

const mockProviderSettingsBackend = async (
  page: Page,
  options: { connectionsMode: "active" | "generic" },
) => {
  let active = true;
  const requests: Array<{ body: string | null; method: string; pathname: string }> = [];
  const getStatusConnection = () =>
    active ? activeStoredConnection : genericNotConnectedConnection;
  const getConnectionsConnection = () =>
    active && options.connectionsMode === "active"
      ? activeStoredConnection
      : genericNotConnectedConnection;

  await page.route(routePath("/auth/session"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "authenticated_session",
        status: "authenticated",
        message: "Backend session verified.",
        identity: {
          userId: "phase88-fix4-user",
          appUserId: "phase88-fix4-user",
          email: "phase88.fix4@example.invalid",
          workspaceId: "phase88-fix4-workspace",
          workspaceRole: "workspace_owner",
          workspaceAuthority: "verified",
        },
      }),
    );
  });

  await page.route(routePath("/provider-settings/catalog"), async (route) => {
    await route.fulfill(jsonResponse(providerCatalogPayload));
  });

  await page.route(routePath("/provider-settings/routing-policy"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "provider_settings_routing_policy",
        routingPreferences,
      }),
    );
  });

  await page.route(routePath("/provider-settings/status"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "provider_settings_status",
        status: "authenticated",
        message: "Provider settings are available with redacted summaries.",
        activeWorkspaceId: "phase88-fix4-workspace",
        routingPreferences,
        connections: [getStatusConnection()],
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
        message: "Validated by backend",
        connection: getStatusConnection(),
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

    if (request.method() === "DELETE") {
      active = false;
      await route.fulfill(
        jsonResponse({
          kind: "provider_settings_connection_revoked",
          status: "revoked",
          message: "Provider key was revoked server-side.",
          connection: revokedConnection,
        }),
      );
      return;
    }

    await route.fulfill(
      jsonResponse({
        kind: "provider_settings_connection_replaced",
        status: "replaced",
        message: "Provider key was replaced server-side.",
        connection: activeStoredConnection,
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
          connections: [getConnectionsConnection()],
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
          kind: "provider_settings_mutation_conflict",
          status: "conflict",
          message: "An active provider key already exists for this workspace/provider.",
        },
        409,
      ),
    );
  });

  return { requests };
};

test.describe("phase88 BYOK hydration authenticated connections regression", () => {
  test("connections fetch uses authenticated bearer path when session token exists", async () => {
    const calls: Array<{ body?: BodyInit | null; headers: Record<string, string>; input: string }> = [];
    const authFetch = createAuthenticatedFetch({
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        calls.push({
          body: init?.body,
          headers: Object.fromEntries(headers.entries()),
          input: String(input),
        });
        return new Response(
          JSON.stringify({ kind: "provider_settings_connections", connections: [] }),
          { status: 200 },
        );
      },
      getSupabaseAuthClient: () => ({
        auth: {
          getAccessToken: async () => ({
            data: "phase88-fix4-bearer-token",
            ok: true,
          }),
        },
        kind: "supabase_auth_client_ready",
      }),
    });

    await authFetch("/provider-settings/connections", {
      credentials: "same-origin",
      method: "GET",
    });

    expect(calls).toEqual([
      {
        body: undefined,
        headers: {
          authorization: "Bearer phase88-fix4-bearer-token",
        },
        input: "/provider-settings/connections",
      },
    ]);
  });

  test("active status summary is not overwritten by generic connections response", async ({
    page,
  }) => {
    const backend = await mockProviderSettingsBackend(page, {
      connectionsMode: "generic",
    });
    await page.goto("/settings/providers", { waitUntil: "load" });

    const keyForm = page.getByTestId("provider-key-form");

    await expect(
      keyForm.getByRole("button", { name: "Replace key", exact: true }),
    ).toBeVisible();
    await expect(
      keyForm.getByRole("button", { name: "Remove key", exact: true }),
    ).toBeEnabled();
    await expect(
      keyForm.getByRole("button", { name: "Validate stored key", exact: true }),
    ).toBeEnabled();
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "Validated by backend",
    );
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "Needs reverification: no",
    );

    await page
      .getByLabel("Primary navigation")
      .getByRole("button", { name: "Mixer", exact: true })
      .click();
    await page.getByTestId("account-menu-trigger").click();
    await page.getByRole("button", { name: "Provider Settings", exact: true }).click();
    await expect(
      keyForm.getByRole("button", { name: "Replace key", exact: true }),
    ).toBeVisible();

    await keyForm.getByRole("button", { name: "Remove key", exact: true }).click();
    await expect(page.getByTestId("provider-key-mutation-message")).toContainText(
      "Provider key was revoked server-side.",
    );
    await page.getByRole("button", { name: "Refresh provider settings" }).click();
    await expect(
      keyForm.getByRole("button", { name: "Save key", exact: true }),
    ).toBeVisible();
    await expect(
      keyForm.getByRole("button", { name: "Store key before validation", exact: true }),
    ).toBeDisabled();
    await expectNoBrowserPersistence(page, rawProviderKey);
    expect(backend.requests).toEqual([
      {
        body: null,
        method: "DELETE",
        pathname: "/provider-settings/connections/openai",
      },
    ]);
  });

  test("active authenticated connections response is accepted directly", async ({ page }) => {
    await mockProviderSettingsBackend(page, {
      connectionsMode: "active",
    });
    await page.goto("/settings/providers", { waitUntil: "load" });

    const keyForm = page.getByTestId("provider-key-form");
    await expect(
      keyForm.getByRole("button", { name: "Replace key", exact: true }),
    ).toBeVisible();
    await expect(
      keyForm.getByRole("button", { name: "Remove key", exact: true }),
    ).toBeEnabled();
    await expect(
      keyForm.getByRole("button", { name: "Validate stored key", exact: true }),
    ).toBeEnabled();
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "provider-key:fix4",
    );
  });

  test("source boundaries keep auth fetch narrow and avoid provider runtime expansion", () => {
    const serviceSource = readSource("src/services/providerSettingsService.ts");
    const storeSource = readSource("src/store/providerSettingsStore.ts");
    const authenticatedFetchSource = readSource(
      "src/services/auth/authenticatedFetch.ts",
    );
    const pageSource = readSource("src/pages/ProviderSettingsPage.tsx");
    const packageJson = readSource("package.json");
    const combinedFrontend = [
      serviceSource,
      storeSource,
      authenticatedFetchSource,
      pageSource,
    ].join("\n");

    expect(serviceSource).toContain(
      "fetchWithOptionalAccountBearer(providerConnectionsEndpoint",
    );
    expect(authenticatedFetchSource).toContain('"/provider-settings/connections"');
    expect(storeSource).toContain("mergeRefreshedConnections(");
    expect(storeSource).toContain("statusProjection.connections");

    for (const forbidden of [
      "localStorage.setItem",
      "sessionStorage.setItem",
      "document.cookie",
      "api.openai.com",
      "replicate.com",
      "api.runway",
      "api.luma",
      "generativelanguage.googleapis.com",
      "@openai/",
      "@replicate/",
      "@runway",
      "@luma",
      'fetch("https://',
      "fetch(`https://",
      "Connected",
      "connected_success",
      "Verified provider",
      "verified_success",
      "Test passed",
      "test_passed",
      "Live provider ready",
      "Generation enabled",
    ]) {
      expect(combinedFrontend).not.toContain(forbidden);
      expect(packageJson).not.toContain(forbidden);
    }
  });
});
