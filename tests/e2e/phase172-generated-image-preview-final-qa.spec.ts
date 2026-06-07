import { expect, test, type Page } from "@playwright/test";

const tinyPngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

const imageMetadataResponse = {
  kind: "generation_job_metadata_ready",
  status: "generated_metadata_ready",
  message:
    "Mock local image generation produced verified local metadata for backend smoke only; delivery remains unavailable.",
  artifact: {
    artifactId: "phase172-image-artifact",
    providerId: "mock_local",
    contentType: "image/png",
    sizeBytes: tinyPngBytes.length,
    sha256:
      "1721721721721721721721721721721721721721721721721721721721721721",
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
  "rootPath",
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

test.describe("Phase 172 generated image preview final QA", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await installNetworkTripwires(page);
  });

  test("workspace renders backend-mediated image preview without unsafe delivery surfaces", async ({
    page,
  }) => {
    const generationRequests: unknown[] = [];
    const previewRequests: string[] = [];

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
      previewRequests.push(route.request().url());
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
    await expect(page.getByText("Image lane")).toBeVisible();
    await expect(page.getByText("Video lane")).toBeVisible();
    await expect(page.getByText("Local history", { exact: true })).toBeVisible();

    await page
      .getByLabel("Image prompt")
      .fill("Phase 172 final generated image preview QA.");
    await page.getByRole("button", { name: "Generate Image" }).click();

    const preview = page.getByRole("img", {
      name: "Backend-mediated generated image preview",
    });

    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute(
      "src",
      /\/generation\/jobs\/.+\/artifacts\/phase172-image-artifact\/preview/,
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
      "Phase 172 final generated image preview QA.",
    );

    await page
      .getByLabel("Video prompt")
      .fill("Phase 172 video preview should stay unavailable.");
    await page.getByRole("button", { name: "Generate Video" }).click();

    await expect(page.getByTestId("prompt-video-lifecycle")).toContainText(
      "video_artifact_storage_unavailable",
    );
    await expect(page.locator("video")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /download/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /download/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /public|signed/i })).toHaveCount(0);
    await expectNoUnsafeTokens(page);

    expect(generationRequests).toHaveLength(2);
    expect(previewRequests).toHaveLength(1);
    expect(previewRequests[0]).toContain("/generation/jobs/");
    expect(previewRequests[0]).toContain(
      "/artifacts/phase172-image-artifact/preview",
    );
    expect(previewRequests[0]).not.toContain("/exports/");
    expect(previewRequests[0]).not.toContain("supabase");
    expect(previewRequests[0]).not.toContain("download");
  });
});
