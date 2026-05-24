import { expect, test } from "@playwright/test";

test.describe("product phase 14 byok credit policy copy", () => {
  test("provider settings explains provider cost versus platform limits clearly", async ({ page }) => {
    await page.route("**/provider-settings/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "provider_catalog",
          message: "Supported BYOK providers are listed.",
          providers: [
            {
              id: "openai",
              displayName: "OpenAI",
              capabilities: ["image_generation", "image_editing", "template_generation_candidate", "card_generation_candidate", "prompt_text_intelligence"],
              supportsByok: true,
              summary: "General-purpose provider.",
              officialWebsite: "https://openai.com",
              docsUrl: "https://platform.openai.com/docs",
              securityNote: "API keys must remain backend-managed later.",
              costNote: "Provider cost comes from the user’s own OpenAI account balance or trial credits when BYOK is enabled later.",
              platformLimitNote: "Free AI Mixer platform credits remain separate from OpenAI account usage and do not multiply when more keys are added.",
              status: "available",
            },
          ],
        }),
      });
    });
    await page.route("**/provider-settings/status", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "provider_settings_unavailable",
          status: "auth_not_configured",
          message: "Authentication is not configured on this backend yet.",
        }),
      });
    });
    await page.route("**/provider-settings/connections", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "provider_settings_connections",
          message: "Connection summaries remain read-only.",
          connections: [
            {
              providerId: "openai",
              status: "not_connected",
              maskedKeySummary: "Secure API key connection is not enabled yet.",
              lastValidationStatus: "not_enabled_yet",
            },
          ],
        }),
      });
    });
    await page.route("**/provider-settings/routing-policy", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "provider_settings_routing_policy",
          message: "Routing policy metadata only.",
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
      });
    });

    await page.goto("/settings/providers", { waitUntil: "load" });

    await expect(
      page.getByText(
        "Provider balance and credits belong to the user’s provider account. Free AI Mixer does not grant or multiply provider credits.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Free AI Mixer platform credits and limits are separate from provider usage."),
    ).toBeVisible();
    await expect(
      page.getByText("Adding multiple API keys does not multiply platform credits."),
    ).toBeVisible();
    await expect(
      page.getByText("Fallback may use additional provider balance only if fallback is explicitly enabled."),
    ).toBeVisible();
    await expect(
      page.getByText(/keys will later be encrypted backend-side, never shown again after submission/i).first(),
    ).toBeVisible();
  });

  test("provider settings does not show fake connected state, balances, or free credits", async ({ page }) => {
    await page.route("**/provider-settings/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "provider_catalog",
          message: "Supported BYOK providers are listed.",
          providers: [],
        }),
      });
    });
    await page.route("**/provider-settings/status", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "provider_settings_unavailable",
          status: "auth_not_configured",
          message: "Authentication is not configured on this backend yet.",
        }),
      });
    });
    await page.route("**/provider-settings/connections", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "provider_settings_connections",
          message: "Connection summaries remain read-only.",
          connections: [],
        }),
      });
    });
    await page.route("**/provider-settings/routing-policy", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "provider_settings_routing_policy",
          message: "Routing policy metadata only.",
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
      });
    });

    await page.goto("/settings/providers", { waitUntil: "load" });

    await expect(page.getByTestId("provider-settings-page")).not.toContainText("Provider connected");
    await expect(page.getByTestId("provider-settings-page")).not.toContainText("Connected");
    await expect(page.getByTestId("provider-settings-page")).not.toContainText("Credits remaining");
    await expect(page.getByTestId("provider-settings-page")).not.toContainText("Balance remaining");
    await expect(page.getByTestId("provider-settings-page")).not.toContainText("API key connected");
  });
});
