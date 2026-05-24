import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const listFrontendSourceFiles = (directory: string): string[] => {
  const fullPath = path.join(projectRoot, directory);
  const entries = readdirSync(fullPath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const relativePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listFrontendSourceFiles(relativePath);
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      return [relativePath];
    }

    return [];
  });
};

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const catalogBody = {
  kind: "ai_tools_catalog",
  message:
    "AI tools catalog is a static editorial directory only. It does not rank tools, trigger providers, or claim live integration.",
  tools: [
    {
      toolId: "tool-runway",
      slug: "runway",
      name: "Runway",
      companyOrProvider: "Runway",
      officialWebsiteUrl: "https://runwayml.com/",
      shortDescription: "Creative AI platform focused on video generation, editing, and media production workflows.",
      categories: ["video_generation", "editing", "creative_suite"],
      capabilities: ["video_generation", "image_generation", "editing_tools"],
      supportedInputTypes: ["text", "image", "video"],
      supportedOutputTypes: ["video", "image"],
      apiAvailability: "unknown",
      byokSupportStatus: "unknown",
      pricingStatus: "unknown",
      pricingSourceUrl: "https://runwayml.com/pricing/",
      freeAiMixerIntegrationStatus: "unknown",
      sourceUrls: ["https://runwayml.com/", "https://runwayml.com/pricing/"],
      lastReviewedAt: "2026-05-23T00:00:00.000Z",
      lastUpdatedAt: "2026-05-23T00:00:00.000Z",
      editorialStatus: "published",
      disclaimer: "Editorial summary only. Unknown fields remain unknown until reviewed against official provider sources.",
    },
  ],
} as const;

const detailBody = {
  kind: "ai_tool_detail",
  message:
    "AI tool detail is editorial only. Verify official provider sources before relying on capabilities, pricing, or integration assumptions.",
  tool: {
    ...catalogBody.tools[0],
    limitations: [
      "API and enterprise availability should be checked directly with the provider.",
    ],
    bestUseCases: ["Short-form motion generation"],
  },
} as const;

test.describe("product phase 11 ai tools catalog shell", () => {
  test("ai tools directory renders honest editorial catalog shell with unknown fields left unknown", async ({ page }) => {
    await page.route("**/ai-tools/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(catalogBody),
      });
    });

    await page.goto("/ai-tools", { waitUntil: "load" });

    const toolCard = page.getByTestId("ai-tool-card-tool-runway");
    await expect(page.getByTestId("ai-tools-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI tools directory shell" })).toBeVisible();
    await expect(toolCard).toBeVisible();
    await expect(toolCard).toContainText("Pricing: unknown");
    await expect(toolCard).toContainText("Integration: unknown");
    await expect(page.getByText(/5 stars|top rated|most popular/i)).toHaveCount(0);
    await expect(page.getByText(/editorial and source-linked only/i)).toBeVisible();
  });

  test("tool detail pages show source, last-reviewed disclaimers, and no fake integration claims", async ({ page }) => {
    await page.route("**/ai-tools/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(catalogBody),
      });
    });

    await page.route("**/ai-tools/tool-runway", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detailBody),
      });
    });

    await page.goto("/ai-tools/runway", { waitUntil: "load" });

    await expect(page.getByTestId("ai-tool-detail-page")).toBeVisible();
    await expect(page.getByTestId("ai-tool-detail-card")).toContainText("Last reviewed:");
    await expect(page.getByTestId("ai-tool-detail-card")).toContainText(
      "Verify capabilities, pricing, and plan details with official provider sources.",
    );
    await expect(page.getByTestId("ai-tool-detail-card")).toContainText(
      "Free AI Mixer integration: unknown",
    );
    await expect(page.getByText(/connected now|fully integrated/i)).toHaveCount(0);
  });

  test("frontend source avoids supabase storage, fake ratings, and fake editorial shortcuts", async () => {
    const frontendSource = listFrontendSourceFiles("src")
      .map((relativePath) => readSource(relativePath))
      .join("\n");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain("SERVICE_ROLE");
    expect(frontendSource).not.toContain("5 stars");
    expect(frontendSource).not.toContain("Top rated");
  });
});
