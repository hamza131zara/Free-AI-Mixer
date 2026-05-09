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

const appTitle = "Free AI Mixer";

const gotoApp = async (page: Parameters<typeof test>[0]["page"]): Promise<void> => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: appTitle })).toBeVisible();
};

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

const sceneCard = (
  page: Parameters<typeof test>[0]["page"],
  prompt: string,
) => page.locator(".scene-card").filter({ hasText: prompt });

const createProviderJob = (
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
    prompt: "Resume seeded scene",
    style: "cinematic",
    duration: 8,
  }),
  resumeVersion: 1,
  ...overrides,
});

test.describe("Phase 3.8D1 persisted provider job hydration classification", () => {
  test("valid persisted provider job auto-resumes polling without submitting a new job", async ({
    page,
  }) => {
    const prompt = "Resume seeded scene";
    const queueLogs: string[] = [];
    let submitCount = 0;
    let pollCount = 0;
    page.on("console", (message) => {
      const text = message.text();
      if (text.includes("[Queue] Starting job:")) {
        queueLogs.push(text);
      }
    });

    await setRuntimeConfig(page, {
      baseUrl: "http://127.0.0.1:4173",
      generationPath: "/scenes/generate",
      pollPath: "/scenes/jobs",
      pollDelayMs: 50,
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
            providerJob: createProviderJob(),
            queuedAt: "2026-05-08T00:00:00.000Z",
            startedAt: "2026-05-08T00:00:01.000Z",
          }),
        ],
      }),
    );

    await page.route(sceneApiUrl, async (route) => {
      submitCount += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "submit should not be called during resume",
        }),
      });
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
            pollAfterMs: 50,
            remoteStatus: "processing",
          },
        }),
      });
    });

    await gotoApp(page);
    await expectSceneLifecycle(page, prompt, "generating");
    await expect
      .poll(() => pollCount, { timeout: 2_000 })
      .toBeGreaterThan(0);
    await expect(sceneCard(page, prompt)).toContainText(
      /Waiting for provider|Polling provider job/,
    );
    await expect(sceneCard(page, prompt)).not.toContainText("Resumable job found");
    expect(queueLogs).toHaveLength(0);
    expect(submitCount).toBe(0);
  });

  test("first poll success after reload applies success once", async ({ page }) => {
    const prompt = "Resume success scene";
    let submitCount = 0;
    let pollCount = 0;

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
            providerJob: createProviderJob({
              requestFingerprint: JSON.stringify({
                provider: "replicate",
                prompt,
                style: "cinematic",
                duration: 8,
              }),
            }),
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
          image: "https://example.com/resume-success.png",
          variations: ["https://example.com/resume-success-variation.png"],
        }),
      });
    });

    await gotoApp(page);
    await expectSceneLifecycle(page, prompt, "success");
    await expect(sceneCard(page, prompt).locator(".scene-image")).toHaveAttribute(
      "src",
      "https://example.com/resume-success.png",
    );
    await expect(sceneCard(page, prompt)).toContainText(
      "Provider job completed after reload",
    );
    expect(submitCount).toBe(0);
    expect(pollCount).toBe(1);

    const scenes = (await readPersistedScenes(page)) as Array<{
      lifecycle: string;
      result?: { image?: string };
    }>;
    expect(scenes[0]?.lifecycle).toBe("success");
    expect(scenes[0]?.result?.image).toBe("https://example.com/resume-success.png");
  });

  test("first poll failure after reload applies error once", async ({ page }) => {
    const prompt = "Resume failure scene";
    let submitCount = 0;
    let pollCount = 0;

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
            providerJob: createProviderJob({
              requestFingerprint: JSON.stringify({
                provider: "replicate",
                prompt,
                style: "cinematic",
                duration: 8,
              }),
            }),
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
          status: "failed",
          error: {
            message: "Provider failed after reload.",
            code: "provider_failed",
          },
        }),
      });
    });

    await gotoApp(page);
    await expectSceneLifecycle(page, prompt, "error");
    await expect(sceneCard(page, prompt)).toContainText(
      "Provider failed after reload.",
    );
    await expect(sceneCard(page, prompt)).toContainText(
      "Provider job failed after reload",
    );
    expect(submitCount).toBe(0);
    expect(pollCount).toBe(1);

    const scenes = (await readPersistedScenes(page)) as Array<{
      lifecycle: string;
      error?: { code?: string };
    }>;
    expect(scenes[0]?.lifecycle).toBe("error");
    expect(scenes[0]?.error?.code).toBe("provider_failed");
  });

  test("poll 404 after reload becomes provider_job_not_found", async ({ page }) => {
    const prompt = "Resume not found scene";
    let submitCount = 0;
    let pollCount = 0;

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
            providerJob: createProviderJob({
              requestFingerprint: JSON.stringify({
                provider: "replicate",
                prompt,
                style: "cinematic",
                duration: 8,
              }),
            }),
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
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          message: "job not found",
        }),
      });
    });

    await gotoApp(page);
    await expectSceneLifecycle(page, prompt, "error");
    await expect(sceneCard(page, prompt)).toContainText(
      "Scene generation provider job was not found.",
    );
    await expect(sceneCard(page, prompt)).toContainText("Provider job not found");
    await expect(
      sceneCard(page, prompt).getByRole("button", { name: "Retry scene" }),
    ).toBeEnabled();
    expect(submitCount).toBe(0);
    expect(pollCount).toBe(1);

    const scenes = (await readPersistedScenes(page)) as Array<{
      lifecycle: string;
      error?: { code?: string };
    }>;
    expect(scenes[0]?.lifecycle).toBe("error");
    expect(scenes[0]?.error?.code).toBe("provider_job_not_found");
  });

  test("expired provider job becomes stale error on hydration", async ({ page }) => {
    const prompt = "Expired resume scene";

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
            providerJob: createProviderJob({
              timeoutAt: "2020-05-08T00:00:30.000Z",
              requestFingerprint: JSON.stringify({
                provider: "replicate",
                prompt,
                style: "cinematic",
                duration: 8,
              }),
            }),
            queuedAt: "2026-05-08T00:00:00.000Z",
            startedAt: "2026-05-08T00:00:01.000Z",
          }),
        ],
      }),
    );

    await gotoApp(page);
    await expectSceneLifecycle(page, prompt, "error");
    await expect(sceneCard(page, prompt)).toContainText(
      "Provider job expired before resume could start.",
    );
    await expect(sceneCard(page, prompt)).toContainText("Provider job expired");
    await expect(
      sceneCard(page, prompt).getByRole("button", { name: "Retry scene" }),
    ).toBeEnabled();
  });

  test("corrupt provider job metadata fails safely", async ({ page }) => {
    const prompt = "Corrupt resume scene";

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
            providerJob: createProviderJob({
              jobId: "",
            }),
            queuedAt: "2026-05-08T00:00:00.000Z",
            startedAt: "2026-05-08T00:00:01.000Z",
          }),
        ],
      }),
    );

    await gotoApp(page);
    await expectSceneLifecycle(page, prompt, "error");
    await expect(sceneCard(page, prompt)).toContainText(
      "Persisted provider job metadata could not be resumed safely.",
    );
    await expect(sceneCard(page, prompt)).toContainText("Resume unavailable");
    await expect(
      sceneCard(page, prompt).getByRole("button", { name: "Retry scene" }),
    ).toBeEnabled();
  });

  test("fingerprint mismatch does not auto-resume and requires user action", async ({
    page,
  }) => {
    const prompt = "Fingerprint mismatch scene";
    let submitCount = 0;
    let pollCount = 0;

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
            providerJob: createProviderJob({
              requestFingerprint: JSON.stringify({
                provider: "replicate",
                prompt: "Different prompt",
                style: "cinematic",
                duration: 8,
              }),
            }),
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
      await route.fulfill({ status: 500, body: "poll should not be called" });
    });

    await gotoApp(page);
    await expectSceneLifecycle(page, prompt, "error");
    await expect(sceneCard(page, prompt)).toContainText(
      "Persisted provider job does not match the current scene payload.",
    );
    await expect(sceneCard(page, prompt)).toContainText("Resume unavailable");
    await expect(
      sceneCard(page, prompt).getByRole("button", { name: "Retry scene" }),
    ).toBeEnabled();
    expect(submitCount).toBe(0);
    expect(pollCount).toBe(0);
  });

  test("terminal success and error scenes never resume", async ({ page }) => {
    await seedStorage(
      page,
      createPersistedStoreValue({
        scenes: [
          createScene({
            id: "success-scene",
            lifecycle: "success",
            payload: { prompt: "Terminal success scene", style: "cinematic", duration: 8 },
            progress: 100,
            provider: "replicate",
            providerJob: createProviderJob({
              sceneId: "success-scene",
              requestFingerprint: JSON.stringify({
                provider: "replicate",
                prompt: "Terminal success scene",
                style: "cinematic",
                duration: 8,
              }),
            }),
            result: {
              image: "https://example.com/terminal-success.png",
              variations: [],
            },
          }),
          createScene({
            id: "error-scene",
            lifecycle: "error",
            payload: { prompt: "Terminal error scene", style: "surreal", duration: 5 },
            progress: 0,
            providerJob: createProviderJob({
              sceneId: "error-scene",
              requestFingerprint: JSON.stringify({
                provider: "replicate",
                prompt: "Terminal error scene",
                style: "surreal",
                duration: 5,
              }),
            }),
            error: {
              message: "Terminal failure",
              code: "provider_failed",
            },
          }),
        ],
      }),
    );

    await gotoApp(page);
    await expectSceneLifecycle(page, "Terminal success scene", "success");
    await expectSceneLifecycle(page, "Terminal error scene", "error");
    await expect(sceneCard(page, "Terminal success scene")).not.toContainText(
      "Resumable job found",
    );
    await expect(sceneCard(page, "Terminal error scene")).not.toContainText(
      "Resumable job found",
    );
  });
});
