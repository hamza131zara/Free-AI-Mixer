import { expect, test } from "@playwright/test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createApp } from "../../backend/app";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

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

const catalogBody = {
  kind: "ai_tool_comparisons_catalog",
  message:
    "Comparison pages are editorial summaries only. Verify pricing, capability, and plan details with official provider sources.",
  comparisons: [
    {
      comparisonId: "comparison-chatgpt-vs-runway",
      slug: "chatgpt-vs-runway-for-creative-workflows",
      title: "ChatGPT vs Runway for creative workflows",
      toolsCompared: ["ChatGPT", "Runway"],
      comparisonCategory: "creative_workflows",
      summary: "Editorial comparison of workflow fit, not a universal best-of ranking.",
      lastReviewedAt: "2026-05-23T00:00:00.000Z",
      editorialStatus: "published",
      disclaimer: "Editorial comparison only. Verify with the official providers.",
    },
  ],
} as const;

const detailBody = {
  kind: "ai_tool_comparison_detail",
  message:
    "Comparison detail is editorial only. No rankings, reviews, or generation execution are provided here.",
  comparison: {
    ...catalogBody.comparisons[0],
    capabilityRows: [
      {
        label: "Primary strength",
        values: {
          ChatGPT: "General-purpose reasoning and drafting",
          Runway: "Video-focused creation and editing",
        },
      },
    ],
    pricingCaveats: ["Verify official pricing pages."],
    bestFor: ["Editorial workflow comparison"],
    limitations: ["No benchmark score is provided."],
    sourceUrls: ["https://openai.com/pricing", "https://runwayml.com/pricing/"],
  },
} as const;

test.describe("product phase 11 comparison pages shell", () => {
  test("comparison pages show caveats and avoid fake ratings or reviews", async ({ page }) => {
    await page.route("**/ai-tools/comparisons", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(catalogBody),
      });
    });

    await page.route("**/ai-tools/comparisons/comparison-chatgpt-vs-runway", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detailBody),
      });
    });

    await page.goto("/compare", { waitUntil: "load" });
    await expect(page.getByTestId("ai-tool-compare-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI tools comparison shell" })).toBeVisible();
    await expect(page.getByText("No fake ratings, reviews, or usage counts are included.")).toBeVisible();

    await page.goto("/compare/chatgpt-vs-runway-for-creative-workflows", { waitUntil: "load" });
    await expect(page.getByTestId("comparison-detail-card")).toContainText(
      "Verify with official provider sources before relying on current pricing or capability details.",
    );
    await expect(page.getByText(/5 stars|4\.9|most popular|best overall/i)).toHaveCount(0);
  });

  test("comparison backend stays read-only and exposes no generate or ranking execution endpoints", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const catalogResponse = await fetch(`${baseUrl}/ai-tools/comparisons`);
      expect(catalogResponse.status).toBe(200);
      await expect(catalogResponse.json()).resolves.toMatchObject({
        kind: "ai_tool_comparisons_catalog",
      });

      const detailResponse = await fetch(
        `${baseUrl}/ai-tools/comparisons/comparison-chatgpt-vs-runway`,
      );
      expect(detailResponse.status).toBe(200);
      await expect(detailResponse.json()).resolves.toMatchObject({
        kind: "ai_tool_comparison_detail",
      });

      const generateResponse = await fetch(
        `${baseUrl}/ai-tools/comparisons/comparison-chatgpt-vs-runway/generate`,
        { method: "POST" },
      );
      expect(generateResponse.status).toBe(404);
    } finally {
      await stopServer(server);
    }
  });

  test("comparison boundary source avoids live ranking engines and generation shortcuts", async () => {
    const combinedSource = [
      readSource("backend/contracts/aiToolsHttpTypes.ts"),
      readSource("backend/aiTools/aiToolComparisonsCatalog.ts"),
      readSource("backend/routes/aiTools.ts"),
      readSource("src/services/aiToolsService.ts"),
      readSource("src/store/aiToolsStore.ts"),
      readSource("src/types/aiTools.ts"),
    ].join("\n");

    expect(combinedSource).not.toContain("/rankings");
    expect(combinedSource).not.toContain("userReview");
    expect(combinedSource).not.toContain("/generation/jobs");
    expect(combinedSource).not.toContain("/exports");
    expect(combinedSource).not.toContain("service_role");
  });
});
