import { expect, test } from "@playwright/test";
import {
  createPersistedStoreValue,
  createScene,
  persistKey,
} from "./helpers/persist";
import { readPersistedScenes, sceneApiUrl } from "./helpers/runtime";

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
      requestFailures.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
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
            id: "success-source-scene",
            lifecycle: "success",
            payload: { prompt: "Successful source scene", style: "cinematic", duration: 8 },
            progress: 100,
            result: {
              image: "https://example.com/success-source.png",
              variations: ["https://example.com/success-source-var.png"],
            },
          }),
          createScene({
            id: "idle-source-scene",
            lifecycle: "idle",
            payload: { prompt: "Idle source scene", style: "surreal", duration: 6 },
            progress: 0,
          }),
          createScene({
            id: "error-source-scene",
            lifecycle: "error",
            payload: { prompt: "Error source scene", style: "product", duration: 5 },
            progress: 0,
            error: { message: "Seeded error", code: "seeded_error" },
          }),
        ],
      }),
    );

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    const timelineHeading = page.getByText("Editorial Timeline");
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
    await expect(source).toContainText("Successful source scene");
    await expect(source).not.toContainText("Idle source scene");
    await expect(source).not.toContainText("Error source scene");

    await source
      .getByRole("button", { name: /Add scene .* to timeline/ })
      .first()
      .click();
    const track = page.getByTestId("timeline-track");
    await expect(track).toContainText("Clip 1");
    await expect(track).toContainText("success-source-scene");
    await expect(track).toContainText("Start");
    await expect(track).toContainText("Duration");

    await track.getByRole("button", { name: "Remove clip" }).first().click();
    await expect(track).toContainText("Timeline is empty");

    const scenes = (await readPersistedScenes(page)) as Array<{
      id: string;
      lifecycle: string;
    }>;
    expect(scenes.find((scene) => scene.id === "success-source-scene")?.lifecycle).toBe(
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

    await expect(page.locator("text=video export")).toHaveCount(0);
    await expect(page.locator("text=backend rendering")).toHaveCount(0);
  });
});
