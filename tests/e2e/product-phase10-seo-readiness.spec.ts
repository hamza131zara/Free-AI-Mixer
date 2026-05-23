import { expect, test } from "@playwright/test";
import { buildPublicSitemapInventory } from "../../src/services/seoMetadataService";

test.describe("product phase 10 seo readiness", () => {
  test("public pages apply route-level titles and descriptions while private routes are noindex", async ({ page }) => {
    await page.goto("/templates", { waitUntil: "load" });
    await expect(page).toHaveTitle("Templates Gallery | Free AI Mixer");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "Static template gallery shell with planning metadata, input requirements, and draft credit estimate ranges.",
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index,follow");

    await page.goto("/admin", { waitUntil: "load" });
    await expect(page).toHaveTitle("Admin Readiness | Free AI Mixer");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow");

    await page.goto("/dashboard", { waitUntil: "load" });
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow");
  });

  test("public sitemap inventory includes only safe public routes", () => {
    const inventory = buildPublicSitemapInventory();
    const paths = inventory.map((entry) => entry.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        "/",
        "/templates",
        "/pricing",
        "/credits",
        "/onboarding",
        "/help",
        "/privacy",
        "/terms",
        "/cookies",
        "/acceptable-use",
        "/data-retention",
      ]),
    );
    expect(paths).not.toContain("/dashboard");
    expect(paths).not.toContain("/projects");
    expect(paths).not.toContain("/history");
    expect(paths).not.toContain("/settings/providers");
    expect(paths).not.toContain("/admin");
  });

  test("seo metadata does not invent reviews ratings usage counts or launch-ready claims", async ({ page }) => {
    await page.goto("/pricing", { waitUntil: "load" });
    const bodyText = (await page.textContent("body")) ?? "";

    expect(bodyText).not.toMatch(/5 stars|4\.9|10,000 users|most popular|launch-ready|Unlimited plan/i);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  });
});
