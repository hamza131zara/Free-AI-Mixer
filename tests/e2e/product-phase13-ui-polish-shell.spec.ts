import { expect, test } from "@playwright/test";

const viewportCases = [
  { name: "desktop", width: 1440, height: 960 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
] as const;

test.describe("product phase 13 ui polish shell", () => {
  test("home page avoids obvious horizontal overflow across desktop tablet and mobile", async ({ page }) => {
    for (const viewport of viewportCases) {
      await test.step(viewport.name, async () => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        await page.goto("/", { waitUntil: "load" });
        await expect(page.getByTestId("home-page")).toBeVisible();

        const hasHorizontalOverflow = await page.evaluate(() => {
          const root = document.documentElement;
          return root.scrollWidth > window.innerWidth + 1;
        });

        expect(hasHorizontalOverflow).toBe(false);
      });
    }
  });

  test("desktop header stays focused on public product routes and excludes help and legal links", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto("/", { waitUntil: "load" });

    const header = page.locator(".site-header");
    await expect(header.getByRole("button", { name: "Home", exact: true })).toBeVisible();
    await expect(header.getByRole("button", { name: "Mixer", exact: true })).toBeVisible();
    await expect(header.getByRole("button", { name: "Templates", exact: true })).toBeVisible();
    await expect(header.getByRole("button", { name: "Cards", exact: true })).toBeVisible();
    await expect(header.getByRole("button", { name: "AI Tools", exact: true })).toBeVisible();
    await expect(header.getByRole("button", { name: "Compare", exact: true })).toBeVisible();
    await expect(header.getByRole("button", { name: "AI News", exact: true })).toBeVisible();
    await expect(header.getByRole("button", { name: "Pricing", exact: true })).toBeVisible();

    await expect(header.getByRole("button", { name: "Help", exact: true })).toHaveCount(0);
    await expect(header.getByRole("button", { name: "Privacy", exact: true })).toHaveCount(0);
    await expect(header.getByRole("button", { name: "Terms", exact: true })).toHaveCount(0);
    await expect(header.getByRole("button", { name: "Cookies", exact: true })).toHaveCount(0);
    await expect(header.getByRole("button", { name: "Acceptable Use", exact: true })).toHaveCount(0);
    await expect(header.getByRole("button", { name: "Data Retention", exact: true })).toHaveCount(0);
  });

  test("home and policy pages stay honest about BYOK credits and downloads", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expect(page.getByText("BYOK users will pay provider generation cost through their own API keys.")).toBeVisible();
    await expect(page.getByText("Future platform credits do not replace provider billing.")).toBeVisible();

    await page.goto("/credits", { waitUntil: "load" });
    await expect(page.getByTestId("credits-page")).toBeVisible();
    await expect(page.getByText("Credits are not enabled yet")).toBeVisible();
    await expect(page.getByText(/Provider connected|API key connected|Download ready/i)).toHaveCount(0);
  });
});
