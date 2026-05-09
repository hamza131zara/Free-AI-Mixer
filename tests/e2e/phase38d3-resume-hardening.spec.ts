import { expect, test } from "@playwright/test";
import {
  createPersistedStoreValue,
  createScene,
  persistKey,
  type PersistedSceneProviderJobState,
} from "./helpers/persist";
import {
  expectSceneLifecycle,
  readPersistedScenes,
  sceneApiUrl,
  scenePollApiUrlPrefix,
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

const seedStorage = async (
  page: Parameters<typeof test>[0]["page"],
  value: string,
): Promise<void> => {
  await page.addInitScript(
    ({ key, persistedValue }) => {
      window.localStorage.setItem(key, persistedValue);
    },
    { key: persistKey, persistedValue: value },
  );
};

const createProviderJob = (
  prompt: string,
  overrides: Partial<PersistedSceneProviderJobState> = {},
): PersistedSceneProviderJobState => ({
  provider: "replicate",
  sceneId: "resume-scene",
  jobId: "job-resume",
  status: "processing",
  remoteStatus: "processing",
  submittedAt: "2026-05-08T00:00:00.000Z",
  lastPolledAt: "2026-05-08T00:00:05.000Z",
  pollAttemptCount: 2,
  timeoutAt: "2099-05-08T00:00:30.000Z",
  requestFingerprint: JSON.stringify({
    provider: "replicate",
    prompt,
    style: "cinematic",
    duration: 8,
  }),
  resumeVersion: 1,
  ...overrides,
});

test.describe("Phase 3.8D3 resume hardening", () => {
  test("resume polling starts once after hydration", async ({ page }) => {
    const prompt = "Resume once scene";
    let submitCount = 0;
    let pollCount = 0;

    await setRuntimeConfig(page, {
      baseUrl: "http://127.0.0.1:4173",
      generationPath: "/scenes/generate",
      pollPath: "/scenes/jobs",
      pollDelayMs: 500,
    });

    await seedStorage(
      page,
      createPersistedStoreValue({
        scenes: [
          createScene({
            id: "resume-scene",
            lifecycle: "generating",
            payload: { prompt, style: "cinematic", duration: 8 },
            progress: 80,
            provider: "replicate",
            providerJob: createProviderJob(prompt),
            queuedAt: "2026-05-08T00:00:00.000Z",
            startedAt: "2026-05-08T00:00:01.000Z",
          }),
        ],
      }),
    );

    await page.route(sceneApiUrl, async (route) => {
      submitCount += 1;
      await route.fulfill({ status: 500, body: "submit should not be called" });
    });

    await page.route(`${scenePollApiUrlPrefix}/job-resume`, async (route) => {
      pollCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-resume",
          status: "processing",
          metadata: {
            pollAfterMs: 500,
            remoteStatus: "processing",
          },
        }),
      });
    });

    await gotoApp(page);
    await expectSceneLifecycle(page, prompt, "generating");
    await expect(sceneCard(page, prompt)).toContainText("Resuming provider job");
    await expect.poll(() => pollCount, { timeout: 2_000 }).toBe(1);
    expect(submitCount).toBe(0);
  });

  test("retry after resumed failure clears old provider job and submits exactly one new job", async ({
    page,
  }) => {
    const prompt = "Retry resumed failure scene";
    let submitCount = 0;
    let resumedPollCount = 0;
    let retryPollCount = 0;

    await setRuntimeConfig(page, {
      baseUrl: "http://127.0.0.1:4173",
      generationPath: "/scenes/generate",
      pollPath: "/scenes/jobs",
      pollDelayMs: 1,
    });

    await seedStorage(
      page,
      createPersistedStoreValue({
        scenes: [
          createScene({
            id: "resume-scene",
            lifecycle: "generating",
            payload: { prompt, style: "cinematic", duration: 8 },
            progress: 80,
            provider: "replicate",
            providerJob: createProviderJob(prompt),
            queuedAt: "2026-05-08T00:00:00.000Z",
            startedAt: "2026-05-08T00:00:01.000Z",
          }),
        ],
      }),
    );

    await page.route(sceneApiUrl, async (route) => {
      submitCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-retry-new",
          status: "submitted",
          metadata: {
            pollAfterMs: 1,
          },
        }),
      });
    });

    await page.route(`${scenePollApiUrlPrefix}/job-resume`, async (route) => {
      resumedPollCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-resume",
          status: "failed",
          error: {
            message: "Resume failed before retry.",
            code: "provider_failed",
          },
        }),
      });
    });

    await page.route(`${scenePollApiUrlPrefix}/job-retry-new`, async (route) => {
      retryPollCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          image: "https://example.com/retry-resume-success.png",
          variations: ["https://example.com/retry-resume-success-variation.png"],
        }),
      });
    });

    await gotoApp(page);
    await expectSceneLifecycle(page, prompt, "error");
    await expect(sceneCard(page, prompt)).toContainText(
      "Provider job failed after reload",
    );

    await sceneCard(page, prompt)
      .getByRole("button", { name: "Retry scene" })
      .click();

    await expectSceneLifecycle(page, prompt, "success");
    await expect(sceneCard(page, prompt).locator(".scene-image")).toHaveAttribute(
      "src",
      "https://example.com/retry-resume-success.png",
    );
    expect(submitCount).toBe(1);
    expect(resumedPollCount).toBe(1);
    expect(retryPollCount).toBe(1);

    const scenes = (await readPersistedScenes(page)) as Array<{
      providerJob?: { jobId?: string };
    }>;
    expect(scenes[0]?.providerJob?.jobId).toBe("job-retry-new");
  });

  test("regenerate after resumed success clears old provider job and submits exactly one new job", async ({
    page,
  }) => {
    const prompt = "Regenerate resumed success scene";
    let submitCount = 0;
    let resumedPollCount = 0;
    let regeneratePollCount = 0;

    await setRuntimeConfig(page, {
      baseUrl: "http://127.0.0.1:4173",
      generationPath: "/scenes/generate",
      pollPath: "/scenes/jobs",
      pollDelayMs: 1,
    });

    await seedStorage(
      page,
      createPersistedStoreValue({
        scenes: [
          createScene({
            id: "resume-scene",
            lifecycle: "generating",
            payload: { prompt, style: "cinematic", duration: 8 },
            progress: 80,
            provider: "replicate",
            providerJob: createProviderJob(prompt),
            queuedAt: "2026-05-08T00:00:00.000Z",
            startedAt: "2026-05-08T00:00:01.000Z",
          }),
        ],
      }),
    );

    await page.route(sceneApiUrl, async (route) => {
      submitCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-regenerate-new",
          status: "submitted",
          metadata: {
            pollAfterMs: 1,
          },
        }),
      });
    });

    await page.route(`${scenePollApiUrlPrefix}/job-resume`, async (route) => {
      resumedPollCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          image: "https://example.com/resume-terminal-success.png",
          variations: ["https://example.com/resume-terminal-success-variation.png"],
        }),
      });
    });

    await page.route(`${scenePollApiUrlPrefix}/job-regenerate-new`, async (route) => {
      regeneratePollCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          image: "https://example.com/regenerated-success.png",
          variations: ["https://example.com/regenerated-success-variation.png"],
        }),
      });
    });

    await gotoApp(page);
    await expectSceneLifecycle(page, prompt, "success");
    await expect(sceneCard(page, prompt)).toContainText(
      "Provider job completed after reload",
    );

    await sceneCard(page, prompt)
      .getByRole("button", { name: "Generate scene" })
      .click();

    await expectSceneLifecycle(page, prompt, "success");
    await expect(sceneCard(page, prompt).locator(".scene-image")).toHaveAttribute(
      "src",
      "https://example.com/regenerated-success.png",
    );
    expect(submitCount).toBe(1);
    expect(resumedPollCount).toBe(1);
    expect(regeneratePollCount).toBe(1);

    const scenes = (await readPersistedScenes(page)) as Array<{
      providerJob?: { jobId?: string };
      result?: { image?: string };
    }>;
    expect(scenes[0]?.providerJob?.jobId).toBe("job-regenerate-new");
    expect(scenes[0]?.result?.image).toBe("https://example.com/regenerated-success.png");
  });
});
