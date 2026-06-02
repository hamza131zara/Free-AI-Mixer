import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createAuthenticatedFetch } from "../../src/services/auth/authenticatedFetch";

const projectRoot = process.cwd();
const rawProviderKey = "FAKE_PHASE85_OPENAI_KEY_DO_NOT_STORE";

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
      summary: "OpenAI provider metadata for BYOK validation testing.",
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
  maskedFingerprint: "provider-key:85stored",
  keyFingerprintSuffix: "85st",
  lastValidationStatus: "not_validated",
  verificationStatus: "not_validated",
  needsReverification: true,
  canManage: true,
};

const validatedConnection = {
  ...storedConnection,
  lastVerifiedAt: "2026-06-02T00:00:00.000Z",
  lastValidationStatus: "validated",
  verificationStatus: "validated",
  needsReverification: false,
};

const validationFailedConnection = {
  ...storedConnection,
  lastValidationStatus: "validation_failed",
  verificationStatus: "validation_failed",
  needsReverification: true,
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
  validationResponse: unknown,
  validationStatus = 200,
) => {
  const requests: Array<{ body: string | null; method: string; pathname: string }> = [];
  let currentConnection = notConnectedConnection;

  await page.route(routePath("/auth/session"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "authenticated_session",
        status: "authenticated",
        message: "Backend session verified.",
        identity: {
          userId: "phase85-user",
          appUserId: "phase85-user",
          supabaseUserId: "phase85-supabase-user",
          email: "phase85.tester@example.test",
          workspaceId: "phase85-workspace",
          workspaceRole: "workspace_owner",
          workspaceAuthority: "verified",
          authProvider: "supabase",
          authSubject: "phase85-supabase-user",
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
        activeWorkspaceId: "phase85-workspace",
        routingPreferences: routingPolicyPayload.routingPreferences,
        connections: [currentConnection],
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
    await route.fulfill(jsonResponse(validationResponse, validationStatus));
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
      body: request.postData(),
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

  return { requests };
};

const createValidationPayload = (
  status:
    | "validated"
    | "validation_failed"
    | "validation_unavailable"
    | "timeout"
    | "rate_limited"
    | "provider_unavailable"
    | "vault_decrypt_failed",
) => ({
  kind: "provider_settings_connection_validation_result",
  status,
  message: `Backend returned ${status}.`,
  ...(status === "validated"
    ? { connection: validatedConnection }
    : status === "validation_failed"
      ? { connection: validationFailedConnection }
      : {}),
});

test.describe("phase85 BYOK test connection frontend activation", () => {
  test("validation button is disabled before a stored key and enabled for manageable stored summaries", async ({
    page,
  }) => {
    const backend = await mockAuthenticatedProviderSettingsBackend(
      page,
      createValidationPayload("validated"),
    );
    await page.goto("/settings/providers", { waitUntil: "load" });

    const keyForm = page.getByTestId("provider-key-form");
    await expect(keyForm).toBeVisible();
    await expect(
      keyForm.getByRole("button", { name: "Store key before validation", exact: true }),
    ).toBeDisabled();

    await page.getByTestId("provider-key-input").fill(rawProviderKey);
    await keyForm.getByRole("button", { name: "Save key", exact: true }).click();

    await expect(page.getByTestId("provider-key-input")).toHaveValue("");
    await expect(
      keyForm.getByRole("button", { name: "Validate stored key", exact: true }),
    ).toBeEnabled();

    await keyForm.getByRole("button", { name: "Validate stored key", exact: true }).click();

    await expect(page.getByTestId("provider-key-mutation-message")).toContainText(
      "Validated by backend",
    );
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "Validated by backend",
    );
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "Verification status: validated",
    );
    expect(backend.requests).toEqual([
      {
        body: JSON.stringify({ apiKey: rawProviderKey, providerId: "openai" }),
        method: "POST",
        pathname: "/provider-settings/connections",
      },
      {
        body: null,
        method: "POST",
        pathname: "/provider-settings/connections/openai/test",
      },
    ]);
    await expect(page.locator("body")).not.toContainText(rawProviderKey);
    await expectNoBrowserPersistence(page, rawProviderKey);
    await expect(page.getByText(/Test passed|Verified provider|Live provider ready|Generation enabled/i)).toHaveCount(0);
  });

  test("validation failure states render safe backend-derived messages", async ({ page }) => {
    const cases = [
      {
        expected: "Validation failed. Check the stored key or replace it.",
        payload: createValidationPayload("validation_failed"),
        statusCode: 200,
      },
      {
        expected: "Provider validation is unavailable on this backend.",
        payload: createValidationPayload("validation_unavailable"),
        statusCode: 503,
      },
      {
        expected: "Validation timed out. Try again later.",
        payload: createValidationPayload("timeout"),
        statusCode: 504,
      },
      {
        expected: "Validation is rate limited. Wait before retrying.",
        payload: createValidationPayload("rate_limited"),
        statusCode: 429,
      },
      {
        expected: "Provider validation endpoint is unavailable.",
        payload: createValidationPayload("provider_unavailable"),
        statusCode: 503,
      },
      {
        expected: "Stored key could not be validated safely. Replace the key.",
        payload: createValidationPayload("vault_decrypt_failed"),
        statusCode: 503,
      },
      {
        expected: "No active stored key found for this provider.",
        payload: {
          kind: "provider_settings_connection_not_found",
          status: "not_found",
          message: "Backend not-found wording should not leak details.",
        },
        statusCode: 404,
      },
    ];

    for (const testCase of cases) {
      const isolatedPage = await page.context().newPage();
      await mockAuthenticatedProviderSettingsBackend(
        isolatedPage,
        testCase.payload,
        testCase.statusCode,
      );
      await isolatedPage.goto("/settings/providers", { waitUntil: "load" });
      const keyForm = isolatedPage.getByTestId("provider-key-form");
      await expect(keyForm).toBeVisible();

      await isolatedPage.getByTestId("provider-key-input").fill(rawProviderKey);
      await keyForm.getByRole("button", { name: "Save key", exact: true }).click();
      await expect(
        keyForm.getByRole("button", { name: "Validate stored key", exact: true }),
      ).toBeEnabled();
      await keyForm.getByRole("button", { name: "Validate stored key", exact: true }).click();

      await expect(isolatedPage.getByTestId("provider-key-mutation-message")).toContainText(
        testCase.expected,
      );
      await expect(isolatedPage.getByText(/Test passed|Verified provider|Live provider ready|Generation enabled/i)).toHaveCount(0);
      await expectNoBrowserPersistence(isolatedPage, rawProviderKey);
      await isolatedPage.close();
    }
  });

  test("authenticated fetch attaches bearer to validation route without broadening external access", async () => {
    const calls: Array<{ body?: BodyInit | null; headers: Record<string, string>; input: string }> = [];
    const authFetch = createAuthenticatedFetch({
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        calls.push({
          body: init?.body,
          headers: Object.fromEntries(headers.entries()),
          input: String(input),
        });
        return new Response("{}", { status: 200 });
      },
      getSupabaseAuthClient: () => ({
        auth: {
          getAccessToken: async () => ({
            data: "phase85-bearer-token",
            ok: true,
          }),
        },
        kind: "supabase_auth_client_ready",
      }),
    });

    await authFetch("/provider-settings/connections/openai/test", {
      method: "POST",
    });

    expect(calls).toEqual([
      {
        body: undefined,
        headers: {
          authorization: "Bearer phase85-bearer-token",
        },
        input: "/provider-settings/connections/openai/test",
      },
    ]);

    await expect(
      authFetch("https://api.openai.com/v1/models", { method: "GET" }),
    ).rejects.toThrow("same-origin relative backend paths");
  });

  test("source boundaries avoid provider SDK calls raw validation body and unrelated runtime expansion", () => {
    const pageSource = readSource("src/pages/ProviderSettingsPage.tsx");
    const serviceSource = readSource("src/services/providerSettingsService.ts");
    const storeSource = readSource("src/store/providerSettingsStore.ts");
    const authenticatedFetchSource = readSource("src/services/auth/authenticatedFetch.ts");
    const packageJson = readSource("package.json");
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const billingService = readSource("src/services/billingService.ts");
    const generationService = readSource("src/services/sceneGenerationService.ts");
    const frontendByokBoundary = `${pageSource}\n${serviceSource}\n${storeSource}\n${authenticatedFetchSource}`;

    expect(serviceSource).toContain("/test");
    expect(serviceSource).toContain('"POST"');
    expect(storeSource).toContain("testProviderConnection");
    expect(authenticatedFetchSource).toContain("(\\/test)?");
    expect(pageSource).toContain("Validation uses the stored backend key reference only");
    expect(pageSource).toContain("Validate stored key");
    expect(pageSource).not.toContain("Test passed");
    expect(pageSource).not.toContain("Verified provider");
    expect(pageSource).not.toContain("Live provider ready");
    expect(pageSource).not.toContain("Generation enabled");

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
    expect(generationService).not.toContain("/provider-settings/connections");
  });
});
