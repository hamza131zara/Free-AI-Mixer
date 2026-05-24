import { expect, test } from "@playwright/test";
import { buildPublicSitemapInventory } from "../../src/services/seoMetadataService";

const toolCatalogBody = {
  kind: "ai_tools_catalog",
  message:
    "AI tools catalog is a static editorial directory only. It does not rank tools, trigger providers, or claim live integration.",
  tools: [
    {
      toolId: "tool-openai-chatgpt",
      slug: "openai-chatgpt",
      name: "ChatGPT",
      companyOrProvider: "OpenAI",
      officialWebsiteUrl: "https://chatgpt.com/",
      shortDescription: "General-purpose conversational assistant for writing, coding, research, and multimodal workflows.",
      categories: ["assistant", "writing", "multimodal"],
      capabilities: ["chat", "image_generation"],
      supportedInputTypes: ["text", "image"],
      supportedOutputTypes: ["text", "image"],
      apiAvailability: "public_api",
      byokSupportStatus: "supported",
      pricingStatus: "unknown",
      pricingSourceUrl: "https://openai.com/pricing",
      freeAiMixerIntegrationStatus: "planned",
      sourceUrls: ["https://openai.com/chatgpt", "https://openai.com/pricing"],
      lastReviewedAt: "2026-05-23T00:00:00.000Z",
      lastUpdatedAt: "2026-05-23T00:00:00.000Z",
      editorialStatus: "published",
      disclaimer: "Editorial summary only. Verify capabilities, pricing, and plan details with the official provider.",
    },
  ],
} as const;

const toolDetailBody = {
  kind: "ai_tool_detail",
  message:
    "AI tool detail is editorial only. Verify official provider sources before relying on capabilities, pricing, or integration assumptions.",
  tool: {
    ...toolCatalogBody.tools[0],
    limitations: ["Capabilities may vary by plan and region."],
    bestUseCases: ["Research assistance"],
  },
} as const;

const newsFeedBody = {
  kind: "ai_news_feed",
  message:
    "AI news feed is a static editorial shell only. No live feed ingestion, scraping, or external fetching happens at request time.",
  items: [
    {
      feedItemId: "news-openai-product-updates-editorial-note",
      slug: "openai-product-updates-editorial-note",
      title: "OpenAI product updates: editorial note",
      summary: "Short editorial summary page pattern for notable provider updates.",
      category: "product_update",
      sourceName: "OpenAI",
      sourceUrl: "https://openai.com/news",
      publishedAt: "2026-05-20T00:00:00.000Z",
      lastCheckedAt: "2026-05-23T00:00:00.000Z",
      editorialNote: "Short summary only. Verify directly with the official source.",
      status: "published",
    },
  ],
} as const;

const newsDetailBody = {
  kind: "ai_news_detail",
  message:
    "AI news detail is a short editorial summary only. Verify source pages for current details and avoid treating it as a live latest-feed claim.",
  item: newsFeedBody.items[0],
} as const;

test.describe("product phase 11 editorial seo boundary", () => {
  test("public editorial pages apply truthful titles descriptions and canonical metadata", async ({ page }) => {
    await page.route("**/ai-tools/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(toolCatalogBody),
      });
    });
    await page.route("**/ai-tools/tool-openai-chatgpt", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(toolDetailBody),
      });
    });
    await page.route("**/ai-news/feed", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(newsFeedBody),
      });
    });
    await page.route("**/ai-news/news-openai-product-updates-editorial-note", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(newsDetailBody),
      });
    });

    await page.goto("/ai-tools", { waitUntil: "load" });
    await expect(page).toHaveTitle("AI Tools Directory | Free AI Mixer");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index,follow");

    await page.goto("/ai-tools/openai-chatgpt", { waitUntil: "load" });
    await expect(page).toHaveTitle("ChatGPT | AI Tools Directory | Free AI Mixer");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "General-purpose conversational assistant for writing, coding, research, and multimodal workflows. Editorial summary with sources, limitations, and last-reviewed metadata.",
    );

    await page.goto("/ai-news/openai-product-updates-editorial-note", { waitUntil: "load" });
    await expect(page).toHaveTitle("OpenAI product updates: editorial note | AI News | Free AI Mixer");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index,follow");
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  });

  test("sitemap includes safe public editorial routes and private routes stay excluded", () => {
    const inventory = buildPublicSitemapInventory();
    const paths = inventory.map((entry) => entry.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        "/ai-tools",
        "/compare",
        "/ai-news",
      ]),
    );
    expect(paths).not.toContain("/admin");
    expect(paths).not.toContain("/dashboard");
    expect(paths).not.toContain("/projects");
    expect(paths).not.toContain("/history");
  });

  test("editorial pages avoid fake review rating usage count and launch-ready claims", async ({ page }) => {
    await page.goto("/ai-tools", { waitUntil: "load" });
    const bodyText = (await page.textContent("body")) ?? "";

    expect(bodyText).not.toMatch(/5 stars|4\.9|10,000 users|most popular|top rated|launch-ready/i);
  });
});
