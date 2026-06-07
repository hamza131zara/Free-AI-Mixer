import { expect, test, type Page } from "@playwright/test";

const videoUnavailableResponse = {
  kind: "generation_job_rejected",
  status: "video_artifact_storage_unavailable",
  message:
    "Mock video generation preconditions passed, but verified video artifact storage is not available yet.",
  runtime: {
    vendorCallsEnabled: false,
  },
  attemptedProviderIds: ["mock_local"],
  generationKind: "video",
  lifecycle: "failed",
  lifecycleTrace: ["submitted", "processing", "failed"],
  diagnosticCode: "video_artifact_verification_unavailable",
  failureCategory: "artifact_storage",
};

const imageMetadataResponse = {
  kind: "generation_job_metadata_ready",
  status: "generated_metadata_ready",
  message:
    "Mock local image generation produced verified local metadata for backend smoke only; delivery remains unavailable.",
  artifact: {
    artifactId: "phase163-image-artifact",
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
  "runwayml.com",
  "pika",
  "veo",
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

const installProviderTripwires = async (page: Page) => {
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

test.describe("Phase 163 frontend prompt-to-video mock UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await installProviderTripwires(page);
  });

  test("submits video request and renders truthful fail-closed lifecycle", async ({
    page,
  }) => {
    const generationRequests: unknown[] = [];

    await page.route("**/generation/jobs", async (route) => {
      const body = route.request().postDataJSON() as {
        generationKind?: string;
      };
      generationRequests.push(body);

      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.fulfill({
        body: JSON.stringify(
          body.generationKind === "video"
            ? videoUnavailableResponse
            : imageMetadataResponse,
        ),
        contentType: "application/json",
        status: body.generationKind === "video" ? 503 : 200,
      });
    });

    await page.goto("/mixer");

    const videoPrompt = page.getByLabel("Video prompt");
    const videoButton = page.getByRole("button", { name: "Generate Video" });

    await expect(videoPrompt).toBeVisible();
    await expect(videoButton).toBeVisible();

    await videoPrompt.fill("A safe mock local video lifecycle request.");
    await videoButton.click();

    await expect(page.getByRole("button", { name: "Submitting video..." })).toBeVisible();
    await expect(page.getByTestId("prompt-video-status")).toContainText(
      "Submitting mock video request",
    );

    await expect(page.getByTestId("prompt-video-status")).toContainText(
      "verified video artifact storage is not available yet",
    );
    await expect(page.getByTestId("prompt-video-error")).toContainText(
      "verified video artifact storage is not available yet",
    );
    await expect(page.getByTestId("prompt-video-lifecycle")).toContainText(
      "failed",
    );
    await expect(page.getByTestId("prompt-video-lifecycle")).toContainText(
      "video_artifact_storage_unavailable",
    );
    await expect(page.getByTestId("prompt-video-lifecycle")).toContainText(
      "mock_local",
    );
    await expect(page.getByTestId("prompt-video-lifecycle")).toContainText(
      "false",
    );
    await expect(page.getByTestId("prompt-video-lifecycle")).toContainText(
      "submitted → processing → failed",
    );

    expect(generationRequests[0]).toMatchObject({
      generationKind: "video",
      prompt: "A safe mock local video lifecycle request.",
      providerId: "mock_local",
    });
    expect((generationRequests[0] as { requestId?: unknown }).requestId).toEqual(
      expect.any(String),
    );
    expect(JSON.stringify(generationRequests[0])).not.toContain("apiKey");
    expect(JSON.stringify(generationRequests[0])).not.toContain("sk-");

    await expect(page.locator("video")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /download/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /download/i })).toHaveCount(0);
    await expectNoForbiddenTokens(page);
  });

  test("image prompt-to-image UI still submits and renders safe metadata", async ({
    page,
  }) => {
    const generationRequests: unknown[] = [];

    await page.route("**/generation/jobs", async (route) => {
      const body = route.request().postDataJSON();
      generationRequests.push(body);
      await route.fulfill({
        body: JSON.stringify(imageMetadataResponse),
        contentType: "application/json",
        status: 200,
      });
    });

    await page.goto("/mixer");
    await page
      .getByLabel("Image prompt")
      .fill("A safe mock image request after adding video UI.");
    await page.getByRole("button", { name: "Generate Image" }).click();

    await expect(page.getByTestId("prompt-image-status")).toContainText(
      "Backend returned verified local artifact metadata",
    );
    await expect(page.getByTestId("prompt-image-metadata")).toContainText(
      "mock_local",
    );
    await expect(page.getByTestId("prompt-image-metadata")).toContainText(
      "image/png",
    );

    expect(generationRequests[0]).toMatchObject({
      generationKind: "image",
      prompt: "A safe mock image request after adding video UI.",
      providerId: "openai",
    });

    await expectNoForbiddenTokens(page);
  });
});
