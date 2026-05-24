import { expect, test } from "@playwright/test";

test.describe("product phase 13 responsive overflow polish", () => {
  test("mobile navigation groups product account resources and legal clearly", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "load" });

    await page.getByRole("button", { name: "Toggle navigation" }).click();
    const mobileGroups = page.getByTestId("mobile-nav-groups");
    await expect(mobileGroups).toBeVisible();
    await expect(mobileGroups.getByText("Product")).toBeVisible();
    await expect(mobileGroups.getByText("Account")).toBeVisible();
    await expect(mobileGroups.getByText("Resources")).toBeVisible();
    await expect(mobileGroups.getByText("Legal")).toBeVisible();
  });

  test("mobile navigation keeps cards and editorial routes reachable with reduced clutter", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "load" });

    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await page.getByTestId("mobile-nav-groups").getByRole("button", { name: "Cards", exact: true }).click();
    await expect(page).toHaveURL(/\/cards$/);
    await expect(page.getByTestId("cards-page")).toBeVisible();

    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await page.getByTestId("mobile-nav-groups").getByRole("button", { name: "AI Tools", exact: true }).click();
    await expect(page).toHaveURL(/\/ai-tools$/);
    await expect(page.getByTestId("ai-tools-page")).toBeVisible();
  });

  test("public pages stay horizontally stable on tablet and mobile", async ({ page }) => {
    for (const viewport of [
      { path: "/", width: 1024, height: 768 },
      { path: "/cards", width: 390, height: 844 },
      { path: "/ai-tools", width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(viewport.path, { waitUntil: "load" });

      const hasHorizontalOverflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth > window.innerWidth + 1;
      });

      expect(hasHorizontalOverflow).toBe(false);
    }
  });
});
