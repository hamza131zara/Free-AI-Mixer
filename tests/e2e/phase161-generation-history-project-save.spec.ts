import { expect, test, type Page } from "@playwright/test";

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

const installNetworkTripwires = async (page: Page) => {
  await page.route("**/*", async (route) => {
    const url = route.request().url();

    if (
      url.includes("api.openai.com") ||
      url.includes("generativelanguage.googleapis.com") ||
      url.includes("imagen") ||
      url.includes("supabase.co/storage")
    ) {
      throw new Error(`Unexpected external provider/storage call: ${url}`);
    }

    await route.continue();
  });
};

const createMetadataResponse = (index: number) => ({
  kind: "generation_job_metadata_ready",
  status: "generated_metadata_ready",
  message:
    "Mock local image generation produced verified local metadata for backend smoke only; delivery remains unavailable.",
  artifact: {
    artifactId: `phase161-artifact-${index}`,
    providerId: "mock_local",
    contentType: "image/png",
    sizeBytes: 68 + index,
    sha256:
      index === 1
        ? "1111111111111111111111111111111111111111111111111111111111111111"
        : "2222222222222222222222222222222222222222222222222222222222222222",
    createdAt: `2026-06-07T00:00:0${index}.000Z`,
    deliveryStatus: "unavailable",
  },
  runtime: {
    vendorCallsEnabled: false,
  },
  attemptedProviderIds: ["mock_local"],
});

const readPersistence = async (page: Page) =>
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
  const persistence = await readPersistence(page);
  const combined = `${visibleText}\n${persistence}`;

  for (const token of forbiddenTokens) {
    expect(combined).not.toContain(token);
  }
};

const submitPrompt = async (page: Page, prompt: string) => {
  await page.getByLabel("Image prompt").fill(prompt);
  await page.getByRole("button", { name: "Generate Image" }).click();
};

test.describe("Phase 161 generation history project save", () => {
  test.beforeEach(async ({ page }) => {
    await installNetworkTripwires(page);
  });

  test("successful mock image metadata is saved into local history", async ({
    page,
  }) => {
    let successCount = 0;
    const requestedPrompts: string[] = [];

    await page.route("**/generation/jobs", async (route) => {
      const body = route.request().postDataJSON() as { prompt?: string };
      const prompt = body.prompt ?? "";
      requestedPrompts.push(prompt);

      if (prompt.includes("fail safely")) {
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
        return;
      }

      successCount += 1;
      await route.fulfill({
        body: JSON.stringify(createMetadataResponse(successCount)),
        contentType: "application/json",
        status: 200,
      });
    });

    await page.goto("/mixer");
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();

    await expect(page.getByTestId("prompt-image-history-empty")).toBeVisible();

    await submitPrompt(page, "First safe mock image history prompt.");
    await expect(page.getByTestId("prompt-image-history-entry")).toHaveCount(1);
    await expect(page.getByTestId("prompt-image-history")).toContainText(
      "First safe mock image history prompt.",
    );
    await expect(page.getByTestId("prompt-image-history")).toContainText(
      "mock_local",
    );
    await expect(page.getByTestId("prompt-image-history")).toContainText(
      "image/png",
    );
    await expect(page.getByTestId("prompt-image-history")).toContainText(
      "metadata_ready",
    );
    await expect(page.getByTestId("prompt-image-history")).toContainText(
      "present",
    );

    await submitPrompt(page, "Second safe mock image history prompt.");
    await expect(page.getByTestId("prompt-image-history-entry")).toHaveCount(2);
    await expect(page.getByTestId("prompt-image-history")).toContainText(
      "Second safe mock image history prompt.",
    );

    await submitPrompt(page, "This should fail safely and stay transient.");
    await expect(page.getByTestId("prompt-image-error")).toContainText(
      "Generated image artifact storage is unavailable.",
    );
    await expect(page.getByTestId("prompt-image-history-entry")).toHaveCount(2);
    await expect(page.getByTestId("prompt-image-history")).not.toContainText(
      "This should fail safely and stay transient.",
    );

    await page.reload();
    await expect(page.getByTestId("prompt-image-history-entry")).toHaveCount(2);
    await expect(page.getByTestId("prompt-image-history")).toContainText(
      "First safe mock image history prompt.",
    );
    await expect(page.getByTestId("prompt-image-history")).toContainText(
      "Second safe mock image history prompt.",
    );

    expect(requestedPrompts).toEqual([
      "First safe mock image history prompt.",
      "Second safe mock image history prompt.",
      "This should fail safely and stay transient.",
    ]);

    await expectNoForbiddenTokens(page);
  });
});
