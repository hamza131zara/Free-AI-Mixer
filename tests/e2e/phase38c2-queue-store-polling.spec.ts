import { expect, test } from "@playwright/test";
import {
  expectSceneLifecycle,
  readPersistedScenes,
  sceneApiUrl,
  scenePollApiUrlPrefix,
  seedSingleIdleScene,
  setRuntimeConfig,
} from "./helpers/runtime";

const gotoApp = async (page: Parameters<typeof test>[0]["page"]): Promise<void> => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Free AI Mixer" })).toBeVisible();
};

const sceneCard = (
  page: Parameters<typeof test>[0]["page"],
  prompt: string,
) => page.locator(".scene-card").filter({ hasText: prompt });

const generateScene = async (
  page: Parameters<typeof test>[0]["page"],
  prompt: string,
): Promise<void> => {
  await sceneCard(page, prompt)
    .getByRole("button", { name: "Generate scene" })
    .click();
};

test.describe("Phase 3.8C2 queue/store polling integration", () => {
  test("accepted provider job polls to terminal success", async ({ page }) => {
    const prompt = "Accepted job success scene";
    let pollCount = 0;

    await setRuntimeConfig(page, {
      baseUrl: "http://127.0.0.1:4173",
      generationPath: "/scenes/generate",
      pollPath: "/scenes/jobs",
    });
    await seedSingleIdleScene(page, prompt);

    await page.route(sceneApiUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-accepted-success",
          status: "submitted",
          metadata: {
            pollAfterMs: 1,
          },
        }),
      });
    });

    await page.route(`${scenePollApiUrlPrefix}/job-accepted-success`, async (route) => {
      pollCount += 1;

      if (pollCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jobId: "job-accepted-success",
            status: "processing",
            metadata: {
              pollAfterMs: 1,
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          image: "https://example.com/polled-success.png",
          variations: ["https://example.com/polled-success-variation.png"],
        }),
      });
    });

    await gotoApp(page);
    await generateScene(page, prompt);

    await expectSceneLifecycle(page, prompt, "success");
    await expect(sceneCard(page, prompt).locator(".scene-image")).toHaveAttribute(
      "src",
      "https://example.com/polled-success.png",
    );
    expect(pollCount).toBeGreaterThanOrEqual(2);

    const scenes = (await readPersistedScenes(page)) as Array<{
      lifecycle: string;
      result?: { image?: string };
    }>;
    expect(scenes[0]?.lifecycle).toBe("success");
    expect(scenes[0]?.result?.image).toBe("https://example.com/polled-success.png");
  });

  test("accepted provider job polls to terminal failure", async ({ page }) => {
    const prompt = "Accepted job failure scene";

    await setRuntimeConfig(page, {
      baseUrl: "http://127.0.0.1:4173",
      generationPath: "/scenes/generate",
      pollPath: "/scenes/jobs",
    });
    await seedSingleIdleScene(page, prompt);

    await page.route(sceneApiUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-accepted-failure",
          status: "submitted",
          metadata: {
            pollAfterMs: 1,
          },
        }),
      });
    });

    await page.route(`${scenePollApiUrlPrefix}/job-accepted-failure`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-accepted-failure",
          status: "failed",
          error: {
            message: "Provider rejected the prompt.",
            code: "provider_failed",
          },
        }),
      });
    });

    await gotoApp(page);
    await generateScene(page, prompt);

    await expectSceneLifecycle(page, prompt, "error");
    await expect(sceneCard(page, prompt).locator(".error-message")).toContainText(
      "Provider rejected the prompt.",
    );

    const scenes = (await readPersistedScenes(page)) as Array<{
      lifecycle: string;
      error?: { code?: string };
    }>;
    expect(scenes[0]?.lifecycle).toBe("error");
    expect(scenes[0]?.error?.code).toBe("provider_failed");
  });
});
