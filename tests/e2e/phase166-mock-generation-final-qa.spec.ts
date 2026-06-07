import { expect, test, type Page } from "@playwright/test";

const forbiddenTokens = [
  "api.openai.com",
  "generativelanguage.googleapis.com",
  "runwayml.com",
  "supabase.co/storage",
  "base64",
  "b64_json",
  "downloadUrl",
  "encrypted_payload",
  "filePath",
  "internalRef",
  "localPath",
  "publicUrl",
  "secret_ref",
  "signedUrl",
  "storageRef",
  "videoBytes",
];

const installNetworkTripwires = async (page: Page) => {
  await page.route("**/*", async (route) => {
    const url = route.request().url();

    if (
      url.includes("api.openai.com") ||
      url.includes("generativelanguage.googleapis.com") ||
      url.includes("runway") ||
      url.includes("pika") ||
      url.includes("veo") ||
      url.includes("supabase.co/storage")
    ) {
      throw new Error(`Unexpected external provider/storage call: ${url}`);
    }

    await route.continue();
  });
};

const expectNoUnsafeTokens = async (page: Page) => {
  const visibleText = await page.locator("body").innerText();
  const browserState = await page.evaluate(() =>
    JSON.stringify({
      cookies: document.cookie,
      localStorage: { ...window.localStorage },
      sessionStorage: { ...window.sessionStorage },
      url: window.location.href,
    }),
  );
  const combined = `${visibleText}\n${browserState}`;

  for (const token of forbiddenTokens) {
    expect(combined).not.toContain(token);
  }
};

test.describe("Phase 166 mock generation final QA", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await installNetworkTripwires(page);
  });

  test("Mixer exposes only the safe metadata-only mock generation workspace", async ({
    page,
  }) => {
    await page.goto("/mixer");

    await expect(
      page.getByRole("heading", { name: "Prompt generation workspace" }),
    ).toBeVisible();
    await expect(page.getByText("Image lane")).toBeVisible();
    await expect(page.getByText("Video lane")).toBeVisible();
    await expect(page.getByText("Local history", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Generate backend-verified image metadata"),
    ).toBeVisible();
    await expect(page.getByText("Prompt to video boundary check")).toBeVisible();
    await expect(page.getByText("Saved image metadata")).toBeVisible();
    await expect(page.getByTestId("prompt-image-history-empty")).toBeVisible();

    await expect(page.locator("video")).toHaveCount(0);
    await expect(
      page.getByRole("img", { name: /generated|preview|playback/i }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /download/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /download/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /public|signed/i })).toHaveCount(0);
    await expectNoUnsafeTokens(page);
  });
});
