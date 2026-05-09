import { expect, test } from "@playwright/test";
import {
  createPersistedStoreValue,
  createScene,
  persistKey,
  type PersistedSceneProviderJobState,
} from "./helpers/persist";
import { expectSceneLifecycle } from "./helpers/runtime";

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
  test("valid persisted provider job is classified as resume-needed", async ({
    page,
  }) => {
    const prompt = "Resume seeded scene";
    const queueLogs: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (text.includes("[Queue] Starting job:")) {
        queueLogs.push(text);
      }
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

    await gotoApp(page);
    await expectSceneLifecycle(page, prompt, "generating");
    await expect(sceneCard(page, prompt)).toContainText("Resumable job found");
    await page.waitForTimeout(500);
    expect(queueLogs).toHaveLength(0);
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
              requestFingerprint: "mismatch",
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
