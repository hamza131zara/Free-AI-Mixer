import { expect, test, type Page } from "@playwright/test";

const imageMetadataResponse = {
  kind: "generation_job_metadata_ready",
  status: "generated_metadata_ready",
  message:
    "Mock local image generation produced verified local metadata for backend smoke only; delivery remains unavailable.",
  artifact: {
    artifactId: "phase165-image-artifact",
    providerId: "mock_local",
    contentType: "image/png",
    sizeBytes: 68,
    sha256:
      "1651651651651651651651651651651651651651651651651651651651651651",
    createdAt: "2026-06-07T00:00:00.000Z",
    deliveryStatus: "unavailable",
  },
  runtime: {
    vendorCallsEnabled: false,
  },
  attemptedProviderIds: ["mock_local"],
};

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

const tinyPngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

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

test.describe("Phase 165 mock generation local runtime smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await installNetworkTripwires(page);
  });

  test("Mixer mock generation UI works with safe local route fixtures", async ({
    page,
  }) => {
    const generationRequests: unknown[] = [];

    await page.route("**/generation/jobs", async (route) => {
      const body = route.request().postDataJSON() as { generationKind?: string };
      generationRequests.push(body);

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
    await page.route("**/generation/jobs/*/artifacts/*/preview", async (route) => {
      await route.fulfill({
        body: tinyPngBytes,
        contentType: "image/png",
        headers: {
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
        status: 200,
      });
    });

    await page.goto("/mixer");

    await expect(
      page.getByRole("heading", { name: "Prompt generation workspace" }),
    ).toBeVisible();
    await expect(
      page.getByText("Generate backend-verified image metadata"),
    ).toBeVisible();

    await page
      .getByLabel("Image prompt")
      .fill("Phase 165 safe local mock image smoke.");
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
    await expect(page.getByTestId("prompt-image-metadata")).toContainText(
      "unavailable",
    );
    await expect(page.getByTestId("prompt-image-history")).toContainText(
      "Phase 165 safe local mock image smoke.",
    );

    await page
      .getByLabel("Video prompt")
      .fill("Phase 165 safe local mock video smoke.");
    await page.getByRole("button", { name: "Generate Video" }).click();

    await expect(page.getByTestId("prompt-video-status")).toContainText(
      "verified video artifact storage is not available yet",
    );
    await expect(page.getByTestId("prompt-video-lifecycle")).toContainText(
      "video_artifact_storage_unavailable",
    );
    await expect(page.getByTestId("prompt-video-lifecycle")).toContainText(
      "submitted → processing → failed",
    );
    await expect(page.getByTestId("prompt-video-lifecycle")).toContainText(
      "mock_local",
    );
    await expect(page.getByTestId("prompt-video-lifecycle")).toContainText(
      "false",
    );

    expect(generationRequests).toHaveLength(2);
    expect(generationRequests[0]).toMatchObject({
      generationKind: "image",
      providerId: "openai",
      prompt: "Phase 165 safe local mock image smoke.",
    });
    expect(generationRequests[1]).toMatchObject({
      generationKind: "video",
      providerId: "mock_local",
      prompt: "Phase 165 safe local mock video smoke.",
    });

    await expect(page.locator("video")).toHaveCount(0);
    await expect(
      page.getByRole("img", {
        name: "Backend-mediated generated image preview",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: "Backend-mediated generated image preview",
      }),
    ).toHaveAttribute(
      "src",
      /\/generation\/jobs\/.+\/artifacts\/phase165-image-artifact\/preview/,
    );
    await expect(page.getByRole("button", { name: /download/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /download/i })).toHaveCount(0);
    await expectNoForbiddenTokens(page);
  });
});
