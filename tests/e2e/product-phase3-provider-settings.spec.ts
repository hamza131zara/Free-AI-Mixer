import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const providerCatalogResponse = {
  kind: "provider_catalog",
  message: "Supported providers are listed for future BYOK routing and capability planning.",
  providers: [
    {
      id: "openai",
      displayName: "OpenAI",
      capabilities: [
        "image_generation",
        "video_generation",
        "native_video_audio",
        "text_to_speech",
      ],
      supportsByok: true,
      summary: "General-purpose multimodal provider.",
    },
    {
      id: "runway",
      displayName: "Runway",
      capabilities: ["video_generation", "native_video_audio", "upscale"],
      supportsByok: true,
      summary: "Video-first creative provider candidate.",
    },
    {
      id: "luma",
      displayName: "Luma",
      capabilities: ["video_generation", "native_video_audio"],
      supportsByok: true,
      summary: "Motion generation provider candidate.",
    },
    {
      id: "google",
      displayName: "Google",
      capabilities: ["image_generation", "video_generation", "music_generation"],
      supportsByok: true,
      summary: "Gemini and Veo family candidate.",
    },
    {
      id: "stability",
      displayName: "Stability",
      capabilities: ["image_generation", "upscale"],
      supportsByok: true,
      summary: "Image and enhancement provider candidate.",
    },
    {
      id: "replicate",
      displayName: "Replicate",
      capabilities: ["image_generation", "video_generation", "sound_effects"],
      supportsByok: true,
      summary: "Broad model marketplace candidate.",
    },
  ],
};

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("product phase 3 provider settings", () => {
  test("provider settings page renders protected state with supported provider catalog and honest copy", async ({
    page,
  }) => {
    await page.route("**/provider-settings/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(providerCatalogResponse),
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

    await page.goto("/settings/providers", { waitUntil: "load" });

    await expect(page.getByTestId("provider-settings-page")).toBeVisible();
    await expect(page.getByTestId("provider-settings-access-state")).toContainText("unavailable");
    await expect(page.getByTestId("provider-settings-access-state")).toContainText(
      "Authentication is not configured on this backend yet.",
    );

    for (const providerName of ["OpenAI", "Runway", "Luma", "Google", "Stability", "Replicate"]) {
      await expect(page.getByRole("heading", { name: providerName })).toBeVisible();
    }

    await expect(page.getByTestId("provider-catalog-grid")).toContainText("Image generation");
    await expect(page.getByTestId("provider-catalog-grid")).toContainText("Video generation");
    await expect(page.getByTestId("provider-catalog-grid")).toContainText("Native video audio");
    await expect(page.getByTestId("provider-catalog-grid")).toContainText("Text to speech");
    await expect(page.getByTestId("provider-catalog-grid")).toContainText("Music generation");
    await expect(page.getByTestId("provider-catalog-grid")).toContainText("Sound effects");
    await expect(page.getByTestId("provider-catalog-grid")).toContainText("Upscale");

    await expect(
      page.getByText("BYOK means users pay provider generation cost through their own API keys later."),
    ).toBeVisible();
    await expect(
      page.getByText("Free BYOK users may later get 2500 daily Free AI Mixer platform credits."),
    ).toBeVisible();
    await expect(
      page.getByText("Multiple API keys do not multiply daily platform credits."),
    ).toBeVisible();
    await expect(
      page.getByText("Audio is optional and provider-capability based, not a separate early setup."),
    ).toBeVisible();
    await expect(page.getByText("Secure API key connection is not enabled yet.", { exact: true })).toBeVisible();
    await expect(page.getByText("Real provider validation is not enabled yet.", { exact: true })).toBeVisible();
    await expect(page.getByText("Routing execution is not enabled yet.", { exact: true })).toBeVisible();
    await expect(page.getByTestId("provider-settings-page")).not.toContainText("Connected");
    await expect(page.getByTestId("provider-settings-page")).not.toContainText("Credits remaining");
  });

  test("frontend source avoids provider key storage supabase storage external vendor calls and fake credits", async () => {
    const providerSettingsSourceFiles = [
      "src/pages/ProviderSettingsPage.tsx",
      "src/services/providerSettingsService.ts",
      "src/services/providerCapabilityLabels.ts",
      "src/store/providerSettingsStore.ts",
      "src/types/providerSettings.ts",
    ];
    const frontendSource = providerSettingsSourceFiles
      .map((relativePath) => readSource(relativePath))
      .join("\n");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("localStorage.setItem");
    expect(frontendSource).not.toContain("sessionStorage.setItem");
    expect(frontendSource).not.toContain("api.openai.com");
    expect(frontendSource).not.toContain("googleapis.com");
    expect(frontendSource).not.toContain("stability.ai");
    expect(frontendSource).not.toContain("replicate.com");
    expect(frontendSource).not.toContain("SERVICE_ROLE");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain("Provider connected");
    expect(frontendSource).not.toContain("Credits remaining: 2500");
  });
});
