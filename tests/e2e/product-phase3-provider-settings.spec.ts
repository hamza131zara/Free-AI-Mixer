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
        "image_editing",
        "video_generation",
        "prompt_text_intelligence",
        "template_generation_candidate",
        "card_generation_candidate",
      ],
      supportsByok: true,
      summary: "General-purpose multimodal provider.",
    },
    {
      id: "runway",
      displayName: "Runway",
      capabilities: [
        "video_generation",
        "text_to_video",
        "image_to_video",
        "video_to_video",
        "audio_generation",
      ],
      supportsByok: true,
      summary: "Video-first creative provider candidate.",
    },
    {
      id: "luma",
      displayName: "Luma",
      capabilities: ["video_generation", "text_to_video", "image_to_video"],
      supportsByok: true,
      summary: "Motion generation provider candidate.",
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
      summary: "Image and enhancement provider candidate.",
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
    await page.route("**/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "authenticated_session",
          status: "authenticated",
          message: "Backend session verified.",
          identity: {
            userId: "verified-user-001",
            workspaceId: "verified-workspace-001",
            authProvider: "supabase",
            authSubject: "verified-user-001",
          },
        }),
      });
    });

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

    const providerCatalogGrid = page.getByTestId("provider-catalog-grid");

    for (const providerName of ["OpenAI", "Runway", "Luma", "Google Gemini/Veo", "Stability", "Replicate"]) {
      await expect(
        providerCatalogGrid.getByRole("heading", { name: providerName, exact: true }),
      ).toBeVisible();
    }

    await expect(providerCatalogGrid).toContainText("Image generation");
    await expect(providerCatalogGrid).toContainText("Video generation");
    await expect(providerCatalogGrid).toContainText("Image editing");
    await expect(providerCatalogGrid).toContainText("Image to video");
    await expect(providerCatalogGrid).toContainText("Text to video");
    await expect(providerCatalogGrid).toContainText("Video to video");
    await expect(providerCatalogGrid).toContainText("Audio generation");
    await expect(providerCatalogGrid).toContainText("Text to speech");
    await expect(providerCatalogGrid).toContainText("Template candidate");
    await expect(providerCatalogGrid).toContainText("Card candidate");
    await expect(providerCatalogGrid).toContainText("Prompt and text intelligence");
    await expect(providerCatalogGrid).toContainText("Model marketplace");

    await expect(
      page.getByText("BYOK means users pay provider generation cost through their own API keys later."),
    ).toBeVisible();
   const capabilityPolicy = page.getByTestId("provider-capability-policy");

await expect(capabilityPolicy).toContainText(
  "Free workspace and mock/demo generation are available.",
);

await expect(capabilityPolicy).toContainText(
  "Some image/video provider APIs require separate provider billing or an eligible provider account.",
);
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
    expect(frontendSource).not.toContain("api.stability.ai");
    expect(frontendSource).not.toMatch(
      /fetch\s*\(\s*["'`]https:\/\/(?:api\.)?stability\.ai/i,
    );
    expect(frontendSource).not.toContain("replicate.com");
    expect(frontendSource).not.toContain("SERVICE_ROLE");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain("Provider connected");
    expect(frontendSource).not.toContain("Credits remaining: 2500");
  });
});
