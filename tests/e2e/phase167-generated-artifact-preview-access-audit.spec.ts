import { expect, test, type Page } from "@playwright/test";

const imageMetadataResponse = {
  kind: "generation_job_metadata_ready",
  status: "generated_metadata_ready",
  message:
    "Mock local image generation produced verified local metadata for backend smoke only; delivery remains unavailable.",
  artifact: {
    artifactId: "phase167-image-artifact",
    providerId: "mock_local",
    contentType: "image/png",
    sizeBytes: 68,
    sha256:
      "1671671671671671671671671671671671671671671671671671671671671671",
    createdAt: "2026-06-07T00:00:00.000Z",
    deliveryStatus: "unavailable",
  },
  runtime: {
    vendorCallsEnabled: false,
  },
  attemptedProviderIds: ["mock_local"],
};

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

    if (
      url.includes("/generation/artifacts") ||
      url.includes("/generated-artifacts") ||
      url.includes("/artifacts/phase167-image-artifact") ||
      url.includes("/exports/phase167")
    ) {
      throw new Error(`Unexpected artifact preview/access call: ${url}`);
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

test.describe("Phase 167 generated artifact preview/access audit", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await installNetworkTripwires(page);
  });

  test("generated image metadata stays metadata-only with no preview/access surface", async ({
    page,
  }) => {
    await page.route("**/generation/jobs", async (route) => {
      await route.fulfill({
        body: JSON.stringify(imageMetadataResponse),
        contentType: "application/json",
        status: 200,
      });
    });

    await page.goto("/mixer");

    await expect(
      page.getByRole("heading", { name: "Prompt generation workspace" }),
    ).toBeVisible();
    await expect(page.getByText("Image lane")).toBeVisible();
    await expect(page.getByText("Video lane")).toBeVisible();
    await expect(page.getByText("Local history", { exact: true })).toBeVisible();

    await page
      .getByLabel("Image prompt")
      .fill("Phase 167 safe metadata-only artifact access audit.");
    await page.getByRole("button", { name: "Generate Image" }).click();

    await expect(page.getByTestId("prompt-image-status")).toContainText(
      "Backend returned verified local artifact metadata",
    );
    await expect(page.getByTestId("prompt-image-metadata")).toContainText(
      "mock_local",
    );
    await expect(page.getByTestId("prompt-image-metadata")).toContainText(
      "unavailable",
    );
    await expect(page.getByTestId("prompt-image-history")).toContainText(
      "Phase 167 safe metadata-only artifact access audit.",
    );

    await expect(page.locator("video")).toHaveCount(0);
    await expect(
      page.getByRole("img", { name: /generated|preview|artifact/i }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /download|preview|play/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /download|preview|public|signed|artifact/i })).toHaveCount(0);

    const hrefs = await page
      .locator("a")
      .evaluateAll((anchors) =>
        anchors.map((anchor) => anchor.getAttribute("href") ?? ""),
      );

    for (const href of hrefs) {
      expect(href).not.toContain("/generation/artifacts");
      expect(href).not.toContain("/generated-artifacts");
      expect(href).not.toContain("/exports/");
      expect(href).not.toContain("publicUrl");
      expect(href).not.toContain("signedUrl");
      expect(href).not.toContain("downloadUrl");
    }

    await expectNoUnsafeTokens(page);
  });
});
