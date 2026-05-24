import { expect, test } from "@playwright/test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../../backend/app";

const startServer = async (): Promise<{ server: Server; baseUrl: string }> => {
  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
};

const stopServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

test.describe("product phase 14 byok provider catalog", () => {
  test("provider settings shows all six provider cards with capabilities and readiness notes", async ({
    page,
  }) => {
    await page.route("**/provider-settings/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "provider_catalog",
          message:
            "Supported BYOK providers are listed for future routing and capability planning. Provider balances remain separate from Free AI Mixer platform credits.",
          providers: [
            {
              id: "openai",
              displayName: "OpenAI",
              capabilities: [
                "image_generation",
                "image_editing",
                "video_generation",
                "prompt_text_intelligence",
                "template_generation_candidate",
                "card_generation_candidate",
              ],
              supportsByok: true,
              summary: "General-purpose multimodal provider candidate for image workflows, prompt intelligence, and future video readiness.",
              officialWebsite: "https://openai.com",
              docsUrl: "https://platform.openai.com/docs",
              securityNote: "Backend-only later.",
              costNote: "User provider balance later.",
              platformLimitNote: "Platform credits remain separate.",
              status: "available",
            },
            {
              id: "runway",
              displayName: "Runway",
              capabilities: ["video_generation", "text_to_video", "image_to_video", "video_to_video", "audio_generation"],
              supportsByok: true,
              summary: "Video-first provider candidate.",
              officialWebsite: "https://runwayml.com",
              docsUrl: "https://docs.dev.runwayml.com",
              securityNote: "Backend-only later.",
              costNote: "User provider balance later.",
              platformLimitNote: "Platform credits remain separate.",
              status: "available",
            },
            {
              id: "luma",
              displayName: "Luma",
              capabilities: ["video_generation", "text_to_video", "image_to_video"],
              supportsByok: true,
              summary: "Motion provider candidate.",
              officialWebsite: "https://lumalabs.ai",
              docsUrl: "https://lumalabs.ai/dream-machine",
              securityNote: "Backend-only later.",
              costNote: "User provider balance later.",
              platformLimitNote: "Platform credits remain separate.",
              status: "available",
            },
            {
              id: "google",
              displayName: "Google Gemini/Veo",
              capabilities: [
                "image_generation",
                "video_generation",
                "text_to_video",
                "image_to_video",
                "prompt_text_intelligence",
                "text_to_speech",
              ],
              supportsByok: true,
              summary: "Gemini and Veo family candidate.",
              officialWebsite: "https://ai.google.dev",
              docsUrl: "https://ai.google.dev/gemini-api/docs",
              securityNote: "Backend-only later.",
              costNote: "User provider balance later.",
              platformLimitNote: "Platform credits remain separate.",
              status: "available",
            },
            {
              id: "stability",
              displayName: "Stability",
              capabilities: [
                "image_generation",
                "image_editing",
                "template_generation_candidate",
                "card_generation_candidate",
              ],
              supportsByok: true,
              summary: "Image-focused provider candidate.",
              officialWebsite: "https://stability.ai",
              docsUrl: "https://platform.stability.ai/docs",
              securityNote: "Backend-only later.",
              costNote: "User provider balance later.",
              platformLimitNote: "Platform credits remain separate.",
              status: "available",
            },
            {
              id: "replicate",
              displayName: "Replicate",
              capabilities: [
                "model_marketplace",
                "image_generation",
                "video_generation",
                "image_to_video",
                "text_to_video",
              ],
              supportsByok: true,
              summary: "Model marketplace candidate.",
              officialWebsite: "https://replicate.com",
              docsUrl: "https://replicate.com/docs",
              securityNote: "Backend-only later.",
              costNote: "User provider balance later.",
              platformLimitNote: "Platform credits remain separate.",
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
          connections: ["openai", "runway", "luma", "google", "stability", "replicate"].map((providerId) => ({
            providerId,
            status: "not_connected",
            maskedKeySummary: "Secure API key connection is not enabled yet.",
            lastValidationStatus: "not_enabled_yet",
          })),
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

    await expect(page.getByTestId("provider-settings-page")).toBeVisible();

    for (const providerName of [
      "OpenAI",
      "Runway",
      "Luma",
      "Google Gemini/Veo",
      "Stability",
      "Replicate",
    ]) {
      await expect(page.getByRole("heading", { name: providerName })).toBeVisible();
    }

    await expect(page.getByTestId("provider-catalog-grid")).toContainText("Image editing");
    await expect(page.getByTestId("provider-catalog-grid")).toContainText("Image to video");
    await expect(page.getByTestId("provider-catalog-grid")).toContainText("Text to video");
    await expect(page.getByTestId("provider-catalog-grid")).toContainText("Video to video");
    await expect(page.getByTestId("provider-catalog-grid")).toContainText("Card candidate");
    await expect(page.getByTestId("provider-catalog-grid")).toContainText("Prompt and text intelligence");
    await expect(page.getByTestId("provider-catalog-grid")).toContainText("Model marketplace");
    await expect(page.getByText("Secure API key connection is not enabled yet.").first()).toBeVisible();
  });

  test("provider catalog endpoint is read-only and returns static metadata only", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/provider-settings/catalog`);
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        kind: string;
        providers: Array<{
          displayName: string;
          officialWebsite: string;
          docsUrl: string;
          capabilities: string[];
        }>;
      };

      expect(body.kind).toBe("provider_catalog");
      expect(body.providers.map((provider) => provider.displayName)).toEqual([
        "OpenAI",
        "Runway",
        "Luma",
        "Google Gemini/Veo",
        "Stability",
        "Replicate",
      ]);
      expect(body.providers.every((provider) => provider.officialWebsite.startsWith("https://"))).toBe(true);
      expect(body.providers.every((provider) => provider.docsUrl.startsWith("https://"))).toBe(true);
      expect(body.providers.some((provider) => provider.capabilities.includes("card_generation_candidate"))).toBe(true);
    } finally {
      await stopServer(server);
    }
  });
});
