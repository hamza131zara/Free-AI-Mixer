import { expect, test } from "@playwright/test";
import {
  expectSceneLifecycle,
  mockSuccessfulGeneration,
  readPersistedScenes,
  sceneApiUrl,
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

const readSinglePersistedScene = async (
  page: Parameters<typeof test>[0]["page"],
): Promise<Record<string, unknown>> => {
  const scenes = (await readPersistedScenes(page)) as Record<string, unknown>[];
  expect(scenes).toHaveLength(1);
  return scenes[0];
};

test.describe("Phase 3.7 transport truthfulness and provider realism", () => {
  test("missing API base URL fails truthfully instead of returning success", async ({
    page,
  }) => {
    const prompt = "Missing configuration scene";
    await setRuntimeConfig(page, {
      baseUrl: "",
      generationPath: "/scenes/generate",
    });
    await seedSingleIdleScene(page, prompt);

    await gotoApp(page);
    await generateScene(page, prompt);

    await expectSceneLifecycle(page, prompt, "error");
    await expect(sceneCard(page, prompt).locator(".error-message")).toContainText(
      "Both scene generation providers failed.",
    );
    await expect(sceneCard(page, prompt)).toContainText("App Stage");
    await expect(sceneCard(page, prompt)).toContainText(
      "Failed after fallback attempt",
    );
    await expect(sceneCard(page, prompt).locator(".scene-output")).toHaveCount(0);

    const scene = await readSinglePersistedScene(page);
    expect(scene.lifecycle).toBe("error");
    expect(scene.error).toMatchObject({
      code: "provider_fallback_failed",
    });

    const details = (scene.error as { details?: Record<string, unknown> }).details as {
      primary: { code?: string };
      fallback: { code?: string };
    };
    expect(details.primary.code).toBe("missing_api_base_url");
    expect(details.fallback.code).toBe("missing_api_base_url");
  });

  test("non-OK HTTP responses fail truthfully and still use centralized fallback", async ({
    page,
  }) => {
    const prompt = "HTTP failure scene";
    const providerOrder: string[] = [];

    await setRuntimeConfig(page, {
      baseUrl: "http://127.0.0.1:4173",
      generationPath: "/scenes/generate",
    });
    await seedSingleIdleScene(page, prompt);
    await page.route(sceneApiUrl, async (route) => {
      const provider = route.request().headers()["x-scene-provider"] ?? "unknown";
      providerOrder.push(provider);

      await route.fulfill({
        status: provider === "replicate" ? 502 : 503,
        contentType: "application/json",
        body: JSON.stringify({
          provider,
          message: `Upstream failure for ${provider}`,
        }),
      });
    });

    await gotoApp(page);
    await generateScene(page, prompt);

    await expectSceneLifecycle(page, prompt, "error");
    expect(providerOrder).toEqual(["replicate", "gemini"]);

    const scene = await readSinglePersistedScene(page);
    const details = (scene.error as { details?: Record<string, unknown> }).details as {
      primary: { code?: string };
      fallback: { code?: string };
    };
    expect(details.primary.code).toBe("http_error");
    expect(details.fallback.code).toBe("http_error");
  });

  test("invalid response payloads fail truthfully instead of surfacing success", async ({
    page,
  }) => {
    const prompt = "Invalid payload scene";

    await setRuntimeConfig(page, {
      baseUrl: "http://127.0.0.1:4173",
      generationPath: "/scenes/generate",
    });
    await seedSingleIdleScene(page, prompt);
    await page.route(sceneApiUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          image: 42,
          variations: "not-an-array",
        }),
      });
    });

    await gotoApp(page);
    await generateScene(page, prompt);

    await expectSceneLifecycle(page, prompt, "error");
    await expect(sceneCard(page, prompt).locator(".scene-output")).toHaveCount(0);

    const scene = await readSinglePersistedScene(page);
    const details = (scene.error as { details?: Record<string, unknown> }).details as {
      primary: { code?: string };
      fallback: { code?: string };
    };
    expect(details.primary.code).toBe("invalid_response_payload");
    expect(details.fallback.code).toBe("invalid_response_payload");
  });

  test("transport exceptions fail truthfully instead of returning success", async ({
    page,
  }) => {
    const prompt = "Transport exception scene";

    await setRuntimeConfig(page, {
      baseUrl: "http://127.0.0.1:4173",
      generationPath: "/scenes/generate",
    });
    await seedSingleIdleScene(page, prompt);
    await page.route(sceneApiUrl, async (route) => {
      await route.abort("failed");
    });

    await gotoApp(page);
    await generateScene(page, prompt);

    await expectSceneLifecycle(page, prompt, "error");

    const scene = await readSinglePersistedScene(page);
    const details = (scene.error as { details?: Record<string, unknown> }).details as {
      primary: { code?: string };
      fallback: { code?: string };
    };
    expect(details.primary.code).toBe("transport_exception");
    expect(details.fallback.code).toBe("transport_exception");
  });

  test("real provider success still works when a truthful transport response succeeds", async ({
    page,
  }) => {
    const prompt = "Truthful success scene";
    await mockSuccessfulGeneration(page);
    await seedSingleIdleScene(page, prompt);

    await gotoApp(page);
    await generateScene(page, prompt);

    await expectSceneLifecycle(page, prompt, "success");
    await expect(sceneCard(page, prompt)).toContainText("App Stage");
    await expect(sceneCard(page, prompt)).toContainText(
      "Completed after primary attempt",
    );
    await expect(page.locator(".status-stage-note")).toContainText(
      "app lifecycle milestones, not provider telemetry",
    );
    await expect(sceneCard(page, prompt).locator(".scene-image")).toHaveCount(1);
  });
});
