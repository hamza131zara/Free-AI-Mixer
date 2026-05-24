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

const feedBody = {
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

const detailBody = {
  kind: "ai_news_detail",
  message:
    "AI news detail is a short editorial summary only. Verify source pages for current details and avoid treating it as a live latest-feed claim.",
  item: feedBody.items[0],
} as const;

test.describe("product phase 11 news feed shell", () => {
  test("news feed pages show source and last-checked metadata with no fake latest claim", async ({ page }) => {
    await page.route("**/ai-news/feed", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(feedBody),
      });
    });

    await page.route("**/ai-news/news-openai-product-updates-editorial-note", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detailBody),
      });
    });

    await page.goto("/ai-news", { waitUntil: "load" });
    await expect(page.getByTestId("ai-news-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI news editorial shell" })).toBeVisible();
    await expect(page.getByText("No fake latest claim, no live ingestion, and no copied article text are used here.")).toBeVisible();

    await page.goto("/ai-news/openai-product-updates-editorial-note", { waitUntil: "load" });
    await expect(page.getByTestId("ai-news-detail-card")).toContainText("Source:");
    await expect(page.getByTestId("ai-news-detail-card")).toContainText("Last checked:");
    await expect(page.getByText(/Latest AI News|breaking now|live feed/i)).toHaveCount(0);
  });

  test("news feed backend stays read-only and does not expose scrape or refresh endpoints", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const feedResponse = await fetch(`${baseUrl}/ai-news/feed`);
      expect(feedResponse.status).toBe(200);
      await expect(feedResponse.json()).resolves.toMatchObject({
        kind: "ai_news_feed",
      });

      const detailResponse = await fetch(
        `${baseUrl}/ai-news/news-openai-product-updates-editorial-note`,
      );
      expect(detailResponse.status).toBe(200);
      await expect(detailResponse.json()).resolves.toMatchObject({
        kind: "ai_news_detail",
      });

      const scrapeResponse = await fetch(`${baseUrl}/ai-news/feed/refresh`, {
        method: "POST",
      });
      expect(scrapeResponse.status).toBe(404);
    } finally {
      await stopServer(server);
    }
  });
});
