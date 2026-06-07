import { expect, test, type Page } from "@playwright/test";

const safeArtifactResponse = {
  kind: "generation_job_metadata_ready",
  status: "generated_metadata_ready",
  message:
    "Mock local image generation produced verified local metadata for backend smoke only; delivery remains unavailable.",
  artifact: {
    artifactId: "phase160-artifact",
    providerId: "mock_local",
    contentType: "image/png",
    sizeBytes: 68,
    sha256:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
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
  "imagen",
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
];

const installProviderTripwires = async (page: Page) => {
  await page.route("**/*", async (route) => {
    const url = route.request().url();

    if (
      url.includes("api.openai.com") ||
      url.includes("generativelanguage.googleapis.com") ||
      url.includes("imagen") ||
      url.includes("supabase.co/storage")
    ) {
      throw new Error(`Unexpected external generation/storage call: ${url}`);
    }

    await route.continue();
  });
};

const readBrowserPersistence = async (page: Page) =>
  page.evaluate(() =>
    JSON.stringify({
      cookies: document.cookie,
      localStorage: { ...window.localStorage },
      sessionStorage: { ...window.sessionStorage },
      url: window.location.href,
    }),
  );

const expectNoForbiddenTokens = async (page: Page) => {
  const visibleText = await page.locator("body").innerText();
  const persistence = await readBrowserPersistence(page);
  const combined = `${visibleText}\n${persistence}`;

  for (const token of forbiddenTokens) {
    expect(combined).not.toContain(token);
  }
};

test.describe("Phase 160 frontend prompt-to-image mock UI", () => {
  test.beforeEach(async ({ page }) => {
    await installProviderTripwires(page);
  });

  test("submits prompt to /generation/jobs and renders safe metadata only", async ({
    page,
  }) => {
    const generationRequests: Array<{
      headers: Record<string, string>;
      postData: unknown;
      url: string;
    }> = [];

    await page.route("**/generation/jobs", async (route) => {
      const request = route.request();
      generationRequests.push({
        headers: request.headers(),
        postData: request.postDataJSON(),
        url: request.url(),
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.fulfill({
        body: JSON.stringify(safeArtifactResponse),
        contentType: "application/json",
        status: 200,
      });
    });

    await page.goto("/mixer");

    const promptInput = page.getByLabel("Image prompt");
    const generateButton = page.getByRole("button", { name: "Generate Image" });

    await expect(promptInput).toBeVisible();
    await expect(generateButton).toBeVisible();

    await promptInput.fill("A deterministic local mock image for metadata only.");
    await generateButton.click();

    await expect(
      page.getByRole("button", { name: "Generating metadata..." }),
    ).toBeVisible();
    await expect(page.getByTestId("prompt-image-status")).toContainText(
      "Submitting prompt",
    );

    await expect(page.getByTestId("prompt-image-status")).toContainText(
      "Backend returned verified local artifact metadata",
    );
    await expect(page.getByTestId("prompt-image-metadata")).toContainText(
      "mock_local",
    );
    await expect(page.getByTestId("prompt-image-metadata")).toContainText(
      "image/png",
    );
    await expect(page.getByTestId("prompt-image-metadata")).toContainText(
      "68 bytes",
    );
    await expect(page.getByTestId("prompt-image-metadata")).toContainText(
      "unavailable",
    );
    await expect(page.getByTestId("prompt-image-metadata")).toContainText(
      "present",
    );

    expect(generationRequests).toHaveLength(1);
    expect(new URL(generationRequests[0].url).pathname).toBe("/generation/jobs");
    expect(generationRequests[0].postData).toMatchObject({
      generationKind: "image",
      prompt: "A deterministic local mock image for metadata only.",
      providerId: "openai",
    });
    expect(
      (generationRequests[0].postData as { requestId?: unknown }).requestId,
    ).toEqual(expect.any(String));
    expect(JSON.stringify(generationRequests[0].postData)).not.toContain("apiKey");
    expect(JSON.stringify(generationRequests[0].postData)).not.toContain("sk-");

    await expectNoForbiddenTokens(page);
  });

  test("renders safe failed state without provider or storage leaks", async ({
    page,
  }) => {
    await page.route("**/generation/jobs", async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          kind: "generation_job_rejected",
          status: "artifact_storage_unavailable",
          message: "Generated image artifact storage is unavailable.",
          runtime: {
            vendorCallsEnabled: false,
          },
          attemptedProviderIds: ["mock_local"],
        }),
        contentType: "application/json",
        status: 503,
      });
    });

    await page.goto("/mixer");
    await page
      .getByLabel("Image prompt")
      .fill("A deterministic local mock image for a safe failure path.");
    await page.getByRole("button", { name: "Generate Image" }).click();

    await expect(page.getByTestId("prompt-image-status")).toContainText(
      "Image generation request failed safely.",
    );
    await expect(page.getByTestId("prompt-image-error")).toContainText(
      "Generated image artifact storage is unavailable.",
    );
    await expect(page.getByTestId("prompt-image-metadata")).toHaveCount(0);

    await expectNoForbiddenTokens(page);
  });
});
