import { expect, test, type Page } from "@playwright/test";
import {
  createPersistedStoreValue,
  createScene,
  persistKey,
} from "./helpers/persist";
import { readPersistedScenes, sceneApiUrl } from "./helpers/runtime";

type SeedStoragePayload = {
  key: string;
  persistedValue: string;
};

const seedStorage = async (page: Page, value: string): Promise<void> => {
  await page.addInitScript(
    ({ key, persistedValue }: SeedStoragePayload) => {
      window.localStorage.setItem(key, persistedValue);
    },
    { key: persistKey, persistedValue: value },
  );
};

test.describe("Phase 4.3 timeline UI", () => {
  test("timeline shell and add-flow work without scene lifecycle mutation or generation trigger", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const requestFailures: string[] = [];
    let generationRequestCount = 0;
    const queueLogs: string[] = [];

    page.on("console", (message) => {
      const text = message.text();

      if (message.type() === "error") {
        consoleErrors.push(text);
      }

      if (text.includes("[Queue] Starting job:")) {
        queueLogs.push(text);
      }
    });

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    page.on("requestfailed", (request) => {
      requestFailures.push(
        `${request.method()} ${request.url()} :: ${
          request.failure()?.errorText ?? "unknown"
        }`,
      );
    });

    await page.route(sceneApiUrl, async (route) => {
      generationRequestCount += 1;
      await route.abort();
    });

    await seedStorage(
      page,
      createPersistedStoreValue({
        scenes: [
          createScene({
            id: "success-source-scene-a",
            lifecycle: "success",
            payload: {
              prompt: "Successful source scene A",
              style: "cinematic",
              duration: 8,
            },
            progress: 100,
            result: {
              image: "https://example.com/success-source-a.png",
              variations: ["https://example.com/success-source-a-var.png"],
            },
          }),
          createScene({
            id: "success-source-scene-b",
            lifecycle: "success",
            payload: {
              prompt: "Successful source scene B",
              style: "cinematic",
              duration: 8,
            },
            progress: 100,
            result: {
              image: "https://example.com/success-source-b.png",
              variations: ["https://example.com/success-source-b-var.png"],
            },
          }),
          createScene({
            id: "idle-source-scene",
            lifecycle: "idle",
            payload: {
              prompt: "Idle source scene",
              style: "surreal",
              duration: 6,
            },
            progress: 0,
          }),
          createScene({
            id: "error-source-scene",
            lifecycle: "error",
            payload: {
              prompt: "Error source scene",
              style: "product",
              duration: 5,
            },
            progress: 0,
            error: {
              message: "Seeded error",
              code: "seeded_error",
            },
          }),
        ],
      }),
    );

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const timelineHeading = page.getByRole("heading", {
      name: "Editorial Timeline",
    });

    if (!(await timelineHeading.isVisible())) {
      const title = await page.title();
      const url = page.url();
      const bodyText = (await page.locator("body").innerText()).slice(0, 500);

      throw new Error(
        [
          "Timeline UI did not render.",
          `url=${url}`,
          `title=${title}`,
          `consoleErrors=${JSON.stringify(consoleErrors)}`,
          `pageErrors=${JSON.stringify(pageErrors)}`,
          `requestFailures=${JSON.stringify(requestFailures)}`,
          `bodyText=${JSON.stringify(bodyText)}`,
        ].join("\n"),
      );
    }

    await expect(page.getByText("No timeline created yet.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Timeline" })).toBeVisible();

    await page.getByRole("button", { name: "Create Timeline" }).click();
    await expect(page.getByTestId("timeline-track")).toContainText("Timeline is empty");

    const source = page.getByTestId("timeline-scene-source");
    await expect(source).toContainText("Successful source scene A");
    await expect(source).toContainText("Successful source scene B");
    await expect(source).not.toContainText("Idle source scene");
    await expect(source).not.toContainText("Error source scene");

    await source
      .getByRole("button", {
        name: "Add scene success-source-scene-a to timeline",
      })
      .click();

    await source
      .getByRole("button", {
        name: "Add scene success-source-scene-b to timeline",
      })
      .click();

    const playback = page.getByTestId("timeline-playback-controls");
    await expect(playback).toBeVisible();
    await expect(playback).toContainText("Preview simulation only");
    await expect(playback).toContainText("Status idle");
    await expect(playback).toContainText("Time 0ms");
    await expect(playback).toContainText("Active Clip success-source-scene-a");

    const track = page.getByTestId("timeline-track");
    const clipCards = track.locator("article.scene-card");

    await expect(clipCards).toHaveCount(2);
    await expect(clipCards.nth(0)).toContainText("success-source-scene-a");
    await expect(clipCards.nth(1)).toContainText("success-source-scene-b");
    await expect(track).toContainText("Start");
    await expect(track).toContainText("Duration");

    await expect(
      clipCards.nth(0).getByRole("button", { name: "Move clip up" }),
    ).toBeDisabled();

    await expect(
      clipCards.nth(0).getByRole("button", { name: "Move clip down" }),
    ).toBeEnabled();

    await expect(
      clipCards.nth(1).getByRole("button", { name: "Move clip up" }),
    ).toBeEnabled();

    await expect(
      clipCards.nth(1).getByRole("button", { name: "Move clip down" }),
    ).toBeDisabled();

    await clipCards.nth(0).getByRole("button", { name: "Move clip down" }).click();
    await expect(clipCards.nth(0)).toContainText("success-source-scene-b");
    await expect(clipCards.nth(1)).toContainText("success-source-scene-a");

    await clipCards.nth(1).getByRole("button", { name: "Move clip up" }).click();
    await expect(clipCards.nth(0)).toContainText("success-source-scene-a");
    await expect(clipCards.nth(1)).toContainText("success-source-scene-b");

    await playback.getByRole("button", { name: "Play" }).click();
    await expect(playback).toContainText("Status playing");

    await playback.getByRole("button", { name: "Pause" }).click();
    await expect(playback).toContainText("Status paused");

    await playback.getByRole("button", { name: "Step forward 1s" }).click();
    await expect(playback).toContainText("Time 1000ms");

    await playback.getByRole("button", { name: "Step back 1s" }).click();
    await expect(playback).toContainText("Time 0ms");

    await playback.getByLabel("Seek timeline").fill("3000");
    await expect(playback).toContainText("Time 3000ms");
    await expect(playback).toContainText("Active Clip success-source-scene-b");

    await playback.getByRole("button", { name: "Stop" }).click();
    await expect(playback).toContainText("Status idle");
    await expect(playback).toContainText("Time 0ms");

    await track.getByRole("button", { name: "Remove clip" }).first().click();
    await expect(clipCards).toHaveCount(1);

    const scenes = (await readPersistedScenes(page)) as Array<{
      id: string;
      lifecycle: string;
    }>;

    expect(scenes.find((scene) => scene.id === "success-source-scene-a")?.lifecycle).toBe(
      "success",
    );

    expect(scenes.find((scene) => scene.id === "success-source-scene-b")?.lifecycle).toBe(
      "success",
    );

    expect(scenes.find((scene) => scene.id === "idle-source-scene")?.lifecycle).toBe(
      "idle",
    );

    expect(scenes.find((scene) => scene.id === "error-source-scene")?.lifecycle).toBe(
      "error",
    );

    expect(generationRequestCount).toBe(0);
    expect(queueLogs).toHaveLength(0);

    const exportPanel = page.getByTestId("timeline-export-panel");
    await expect(exportPanel).toBeVisible();
    await expect(exportPanel).toContainText(
      "No backend rendering queue is built yet.",
    );
    await expect(exportPanel).not.toContainText("Export completed.");
    await expect(exportPanel).not.toContainText("Open artifact");
    await expect(page.locator("text=Download video")).toHaveCount(0);
  });
});
