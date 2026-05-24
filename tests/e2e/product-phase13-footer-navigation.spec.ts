import { expect, test } from "@playwright/test";

test.describe("product phase 13 footer navigation", () => {
  test("footer contains help legal account links plus wordmark and honest social states", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });

    const footer = page.getByTestId("site-footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByRole("heading", { name: "Product", exact: true })).toBeVisible();
    await expect(footer.getByRole("heading", { name: "Explore", exact: true })).toBeVisible();
    await expect(footer.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
    await expect(footer.getByRole("heading", { name: "Resources", exact: true })).toBeVisible();
    await expect(footer.getByRole("heading", { name: "Legal", exact: true })).toBeVisible();
    await expect(footer.getByText("Free AI Mixer")).toBeVisible();
    await expect(footer.getByText("Static product shell, real boundaries.")).toBeVisible();
    await expect(footer.getByRole("button", { name: "Help", exact: true })).toBeVisible();
    await expect(footer.getByRole("button", { name: "Privacy", exact: true })).toBeVisible();
    await expect(footer.getByRole("button", { name: "Terms", exact: true })).toBeVisible();
    await expect(footer.getByRole("button", { name: "Cookies", exact: true })).toBeVisible();
    await expect(footer.getByRole("button", { name: "Acceptable Use", exact: true })).toBeVisible();
    await expect(footer.getByRole("button", { name: "Data Retention", exact: true })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Email", exact: true })).toHaveAttribute(
      "href",
      "mailto:ameer131hd@gmail.com",
    );
    await expect(footer.getByRole("button", { name: "X coming soon" })).toBeDisabled();
    await expect(footer.getByRole("button", { name: "Facebook coming soon" })).toBeDisabled();
    await expect(footer.getByRole("button", { name: "YouTube coming soon" })).toBeDisabled();
  });

  test("footer and header keep public routes reachable without fake states", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });

    await page.locator(".site-header").getByRole("button", { name: "Cards", exact: true }).click();
    await expect(page).toHaveURL(/\/cards$/);
    await expect(page.getByTestId("cards-page")).toBeVisible();

    await page.locator(".site-header").getByRole("button", { name: "AI Tools", exact: true }).click();
    await expect(page).toHaveURL(/\/ai-tools$/);
    await expect(page.getByTestId("ai-tools-page")).toBeVisible();

    await page.locator(".site-header").getByRole("button", { name: "Compare", exact: true }).click();
    await expect(page).toHaveURL(/\/compare$/);
    await expect(page.getByTestId("ai-tool-compare-page")).toBeVisible();

    await page.locator(".site-header").getByRole("button", { name: "AI News", exact: true }).click();
    await expect(page).toHaveURL(/\/ai-news$/);
    await expect(page.getByTestId("ai-news-page")).toBeVisible();

    await page.getByTestId("site-footer").getByRole("button", { name: "Help", exact: true }).click();
    await expect(page).toHaveURL(/\/help$/);
    await expect(page.getByTestId("help-page")).toBeVisible();

    await page.getByTestId("site-footer").getByRole("button", { name: "Provider Settings", exact: true }).click();
    await expect(page).toHaveURL(/\/settings\/providers$/);
    await expect(page.getByTestId("provider-settings-page")).toBeVisible();
    await expect(page.getByText("Secure API key connection is not enabled yet.").first()).toBeVisible();
    await expect(page.getByText(/Provider connected|API key connected/i)).toHaveCount(0);
  });
});
