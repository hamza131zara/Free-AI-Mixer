import { expect, test } from "@playwright/test";
import { buildPublicSitemapInventory } from "../../src/services/seoMetadataService";

const catalogBody = {
  kind: "cards_catalog",
  message:
    "Card templates are available as a static local-preview catalog only. No AI generation, download, share, QR code, or persistence is enabled.",
  templates: [
    {
      cardTemplateId: "card-birthday-confetti-frame",
      slug: "birthday-confetti-frame",
      title: "Birthday confetti frame",
      category: "birthday",
      occasion: "Birthday celebration",
      description:
        "A cheerful birthday card layout with confetti accents, headline space, and a personal message block.",
      supportedFields: [],
      layout: "portrait",
      themeTokens: {
        background: "#fff7ed",
        foreground: "#7c2d12",
        accent: "#fb7185",
        border: "#fdba74",
      },
      outputAspectRatio: "4:5",
      safeUseLabel: "Decorative greeting card template only",
      samplePreviewKind: "static_sample_only",
      status: "published",
      lastReviewedAt: "2026-05-23T00:00:00.000Z",
      sourceOwnershipNotes:
        "Uses original generic decorative styling only. No copyrighted characters or brand assets.",
      disclaimer:
        "Static card template MVP only. No AI generation, download, share, QR code, or project saving is enabled.",
    },
    {
      cardTemplateId: "card-business-contact-minimal",
      slug: "business-contact-minimal",
      title: "Minimal business contact card",
      category: "business",
      occasion: "Business contact card",
      description:
        "A clean decorative business contact card shell for brand name, contact details, and optional website/social handle.",
      supportedFields: [],
      layout: "landscape",
      themeTokens: {
        background: "#f8fafc",
        foreground: "#0f172a",
        accent: "#2563eb",
        border: "#cbd5e1",
      },
      outputAspectRatio: "16:9",
      safeUseLabel:
        "Decorative non-financial business contact template only. Not a payment or bank card.",
      samplePreviewKind: "static_sample_only",
      status: "published",
      lastReviewedAt: "2026-05-23T00:00:00.000Z",
      sourceOwnershipNotes:
        "No payment logos, bank marks, card numbers, CVV, expiry, or deceptive financial styling.",
      disclaimer:
        "This is a decorative contact card shell only. No hosted sharing, QR code, or account persistence is available.",
    },
  ],
} as const;

test.describe("product phase 12 card safety and seo boundary", () => {
  test("public card routes apply truthful titles descriptions and robots metadata", async ({ page }) => {
    await page.route("**/cards/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(catalogBody),
      });
    });

    await page.goto("/cards", { waitUntil: "load" });
    await expect(page).toHaveTitle("Card Generator | Free AI Mixer");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "Static card template MVP with local preview only for greetings, invitations, and business-style cards.",
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index,follow");

    await page.goto("/cards/birthday", { waitUntil: "load" });
    await expect(page).toHaveTitle("Birthday Cards | Free AI Mixer");

    await page.goto("/cards/business", { waitUntil: "load" });
    await expect(page).toHaveTitle("Business Cards | Free AI Mixer");
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  });

  test("sitemap includes safe public card routes only", () => {
    const inventory = buildPublicSitemapInventory();
    const paths = inventory.map((entry) => entry.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        "/cards",
        "/cards/birthday",
        "/cards/wedding",
        "/cards/invitations",
        "/cards/eid",
        "/cards/christmas",
        "/cards/holi",
        "/cards/halloween",
        "/cards/business",
        "/cards/visiting",
        "/cards/gift",
      ]),
    );
    expect(paths).not.toContain("/cards/template/:slug");
    expect(paths).not.toContain("/dashboard");
    expect(paths).not.toContain("/admin");
  });

  test("card pages avoid fake ai download pricing popularity and deceptive financial claims", async ({ page }) => {
    await page.route("**/cards/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(catalogBody),
      });
    });

    await page.goto("/cards", { waitUntil: "load" });
    const bodyText = (await page.textContent("body")) ?? "";

    expect(bodyText).not.toMatch(
      /AI generated|free unlimited downloads|best card maker|5 stars|top rated|most popular|card number|CVV|expiry/i,
    );
  });
});
