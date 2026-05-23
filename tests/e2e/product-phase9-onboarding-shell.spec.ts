import { expect, test } from "@playwright/test";

test.describe("product phase 9 onboarding shell", () => {
  test("onboarding explains BYOK provider cost separation and truthful delivery flow", async ({ page }) => {
    await page.goto("/onboarding", { waitUntil: "load" });

    await expect(page.getByTestId("onboarding-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "First-run onboarding shell" })).toBeVisible();
    await expect(
      page.getByText("BYOK provider cost stays separate from Free AI Mixer platform credits."),
    ).toBeVisible();
    await expect(
      page.getByText("Multiple API keys do not multiply daily platform credits.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/Downloads only become ready when the backend descriptor says the artifact is verified/i),
    ).toBeVisible();
    await expect(
      page.getByText("No fake connected provider, fake balance, or fake download is shown here."),
    ).toBeVisible();
    await expect(page.getByText("Provider connected")).toHaveCount(0);
  });
});
