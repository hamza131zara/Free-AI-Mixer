import { expect, test } from "@playwright/test";
import {
  createPersistedStoreValue,
  createScene,
  persistKey,
} from "./helpers/persist";
import {
  expectSceneLifecycle,
  mockSuccessfulGeneration,
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

const collectQueueStartLogs = (
  page: Parameters<typeof test>[0]["page"],
): string[] => {
  const logs: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (text.includes("[Queue] Starting job:")) {
      logs.push(text);
    }
  });
  return logs;
};

const sceneCard = (
  page: Parameters<typeof test>[0]["page"],
  prompt: string,
) => page.locator(".scene-card").filter({ hasText: prompt });

test.describe("Phase 3.6 hydration and state stability", () => {
  test("H01 — idle scenes survive refresh", async ({ page }) => {
    const prompt = "Idle seeded scene";
    await seedStorage(
      page,
      createPersistedStoreValue({
        draft: {
          prompt: "Saved draft",
          style: "cinematic",
          duration: "12",
        },
        scenes: [
          createScene({
            id: "idle-1",
            lifecycle: "idle",
            payload: { prompt, style: "cinematic", duration: 12 },
          }),
        ],
      }),
    );

    const queueLogs = collectQueueStartLogs(page);

    await gotoApp(page);
    await expectSceneLifecycle(page, prompt, "idle");
    await expect(page.locator("textarea")).toHaveValue("Saved draft");
    await expect(sceneCard(page, prompt)).toContainText("App Stage");
    await expect(sceneCard(page, prompt)).toContainText("Ready to queue");

    await page.reload();
    await expectSceneLifecycle(page, prompt, "idle");
    await expect(sceneCard(page, prompt)).toContainText("App Stage");
    await expect(sceneCard(page, prompt)).toContainText("Ready to queue");
    expect(queueLogs).toHaveLength(0);
  });

  test("H02 — queued scenes reset to idle after refresh", async ({ page }) => {
    const prompt = "Queued seeded scene";
    await seedStorage(
      page,
      createPersistedStoreValue({
        scenes: [
          createScene({
            id: "queued-1",
            lifecycle: "queued",
            payload: { prompt, style: "surreal", duration: 8 },
            progress: 60,
            provider: "replicate",
            queuedAt: "2026-05-08T00:10:00.000Z",
          }),
        ],
      }),
    );

    const queueLogs = collectQueueStartLogs(page);

    await gotoApp(page);
    await expectSceneLifecycle(page, prompt, "idle");
    await expect(sceneCard(page, prompt)).toContainText("Ready to queue");
    await expect(sceneCard(page, prompt)).toContainText("Unassigned");
    expect(queueLogs).toHaveLength(0);
  });

  test("H03 — generating scenes reset to idle after refresh", async ({ page }) => {
    const prompt = "Generating seeded scene";
    await mockSuccessfulGeneration(page);
    await seedStorage(
      page,
      createPersistedStoreValue({
        scenes: [
          createScene({
            id: "generating-1",
            lifecycle: "generating",
            payload: { prompt, style: "architectural", duration: 5 },
            progress: 80,
            provider: "gemini",
            queuedAt: "2026-05-08T00:10:00.000Z",
            startedAt: "2026-05-08T00:11:00.000Z",
          }),
        ],
      }),
    );

    const queueLogs = collectQueueStartLogs(page);

    await gotoApp(page);
    await expectSceneLifecycle(page, prompt, "idle");
    await expect(sceneCard(page, prompt)).toContainText("Ready to queue");
    await expect(sceneCard(page, prompt)).toContainText("Unassigned");

    await sceneCard(page, prompt).getByRole("button", { name: "Generate scene" }).click();
    await expect(sceneCard(page, prompt).locator(".status-pill")).toHaveText(/queued|generating/);
    expect(queueLogs.length).toBeGreaterThanOrEqual(1);
  });

  test("H04 — selectedVariation survives reload when valid", async ({ page }) => {
    const prompt = "Valid selected variation scene";
    const selectedVariation = "https://example.com/variation-2.png";
    await seedStorage(
      page,
      createPersistedStoreValue({
        scenes: [
          createScene({
            id: "success-valid-1",
            lifecycle: "success",
            payload: { prompt, style: "cinematic", duration: 10 },
            progress: 100,
            result: {
              image: "https://example.com/base.png",
              variations: [
                "https://example.com/variation-1.png",
                selectedVariation,
                "https://example.com/variation-3.png",
              ],
            },
            selectedVariation,
            completedAt: "2026-05-08T00:20:00.000Z",
          }),
        ],
      }),
    );

    await gotoApp(page);
    await expect(
      sceneCard(page, prompt).locator(".variation-button.selected"),
    ).toHaveCount(1);
    await expect(sceneCard(page, prompt).locator(".scene-image")).toHaveAttribute(
      "src",
      selectedVariation,
    );

    await page.reload();
    await expect(
      sceneCard(page, prompt).locator(".variation-button.selected"),
    ).toHaveCount(1);
    await expect(sceneCard(page, prompt).locator(".scene-image")).toHaveAttribute(
      "src",
      selectedVariation,
    );
  });

  test("H05 — invalid selectedVariation clears safely", async ({ page }) => {
    const prompt = "Invalid selected variation scene";
    const fallbackImage = "https://example.com/base.png";
    await seedStorage(
      page,
      createPersistedStoreValue({
        scenes: [
          createScene({
            id: "success-invalid-1",
            lifecycle: "success",
            payload: { prompt, style: "cinematic", duration: 10 },
            progress: 100,
            result: {
              image: fallbackImage,
              variations: [
                "https://example.com/variation-1.png",
                "https://example.com/variation-2.png",
              ],
            },
            selectedVariation: "https://example.com/not-in-variations.png",
            completedAt: "2026-05-08T00:20:00.000Z",
          }),
        ],
      }),
    );

    await gotoApp(page);
    await expect(
      sceneCard(page, prompt).locator(".variation-button.selected"),
    ).toHaveCount(0);
    await expect(sceneCard(page, prompt).locator(".scene-image")).toHaveAttribute(
      "src",
      fallbackImage,
    );
  });

  test("H06 — retry works after reload", async ({ page }) => {
    const prompt = "Retryable error scene";
    await mockSuccessfulGeneration(page);
    await seedStorage(
      page,
      createPersistedStoreValue({
        scenes: [
          createScene({
            id: "error-1",
            lifecycle: "error",
            payload: { prompt, style: "product", duration: 4 },
            progress: 0,
            error: { message: "Seeded error" },
            completedAt: "2026-05-08T00:30:00.000Z",
          }),
        ],
      }),
    );

    await gotoApp(page);
    await page.reload();
    await expectSceneLifecycle(page, prompt, "error");

    await sceneCard(page, prompt).getByRole("button", { name: "Retry scene" }).click();
    await expect(sceneCard(page, prompt).locator(".status-pill")).toHaveText(/queued|generating/);
    await expect(sceneCard(page, prompt).locator(".status-pill")).toHaveText("success", {
      timeout: 10000,
    });
  });

  test("H07 — regenerate works after reload", async ({ page }) => {
    const prompt = "Regeneratable success scene";
    await mockSuccessfulGeneration(page);
    await seedStorage(
      page,
      createPersistedStoreValue({
        scenes: [
          createScene({
            id: "success-regen-1",
            lifecycle: "success",
            payload: { prompt, style: "character", duration: 6 },
            progress: 100,
            result: {
              image: "https://example.com/original-success.png",
              variations: ["https://example.com/success-variation.png"],
            },
            completedAt: "2026-05-08T00:35:00.000Z",
          }),
        ],
      }),
    );

    await gotoApp(page);
    await page.reload();
    await expectSceneLifecycle(page, prompt, "success");

    await sceneCard(page, prompt).getByRole("button", { name: "Generate scene" }).click();
    await expect(sceneCard(page, prompt).locator(".status-pill")).toHaveText(/queued|generating/);
    await expect(sceneCard(page, prompt).locator(".status-pill")).toHaveText("success", {
      timeout: 10000,
    });
  });

  test("H08 — corrupt localStorage fails safely", async ({ page }) => {
    await seedStorage(page, "{");

    await gotoApp(page);
    await expect(page.getByRole("heading", { name: appTitle })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Scene" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Generate All" })).toBeDisabled();
    await expect(page.locator(".scene-queue-empty")).toContainText("No scenes queued yet.");
  });

  test("H09 — no duplicate queue jobs start after refresh", async ({ page }) => {
    const promptOne = "Reload queued scene one";
    const promptTwo = "Reload generating scene two";
    await seedStorage(
      page,
      createPersistedStoreValue({
        scenes: [
          createScene({
            id: "reload-queued-1",
            lifecycle: "queued",
            payload: { prompt: promptOne, style: "cinematic", duration: 7 },
            progress: 40,
            provider: "replicate",
            queuedAt: "2026-05-08T00:41:00.000Z",
          }),
          createScene({
            id: "reload-generating-2",
            lifecycle: "generating",
            payload: { prompt: promptTwo, style: "surreal", duration: 9 },
            progress: 90,
            provider: "gemini",
            queuedAt: "2026-05-08T00:42:00.000Z",
            startedAt: "2026-05-08T00:43:00.000Z",
          }),
        ],
      }),
    );

    const queueLogs = collectQueueStartLogs(page);

    await gotoApp(page);
    await expectSceneLifecycle(page, promptOne, "idle");
    await expectSceneLifecycle(page, promptTwo, "idle");
    await page.waitForTimeout(1500);
    expect(queueLogs).toHaveLength(0);
  });

  test("H10 — hydration gate exists", async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator(".status-stage-note")).toContainText(
      "app lifecycle milestones, not provider telemetry",
    );
    await expect(page.getByLabel("Prompt")).toBeEnabled();
    await expect(page.getByLabel("Style")).toBeEnabled();
    await expect(page.getByLabel("Duration")).toBeEnabled();

    await page.getByLabel("Prompt").fill("Hydration gate scene");
    await expect(page.getByRole("button", { name: "Add Scene" })).toBeEnabled();
  });
});
