import { expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { createPersistedStoreValue, createScene, persistKey } from "./persist";

const runtimeBaseUrl = "http://127.0.0.1:4173";
const runtimeGenerationPath = "/scenes/generate";

export const sceneApiUrl = `${runtimeBaseUrl}${runtimeGenerationPath}`;

export const setRuntimeConfig = async (
  page: Page,
  config?: {
    baseUrl?: string;
    generationPath?: string;
  },
): Promise<void> => {
  await page.addInitScript((runtimeConfig) => {
    window.__FREE_AI_MIXER_RUNTIME_CONFIG__ = runtimeConfig;
  }, config);
};

export const seedSingleIdleScene = async (
  page: Page,
  prompt: string,
  sceneId = "scene-under-test",
): Promise<void> => {
  await page.addInitScript(
    ({ key, persistedValue }) => {
      window.localStorage.setItem(key, persistedValue);
    },
    {
      key: persistKey,
      persistedValue: createPersistedStoreValue({
        scenes: [
          createScene({
            id: sceneId,
            lifecycle: "idle",
            payload: { prompt, style: "cinematic", duration: 8 },
          }),
        ],
      }),
    },
  );
};

export const mockSuccessfulGeneration = async (
  page: Page,
  options?: {
    image?: string;
    variations?: string[];
    onRequest?: (route: Route) => void | Promise<void>;
  },
): Promise<void> => {
  await setRuntimeConfig(page, {
    baseUrl: runtimeBaseUrl,
    generationPath: runtimeGenerationPath,
  });

  await page.route(sceneApiUrl, async (route) => {
    await options?.onRequest?.(route);
    await new Promise((resolve) => setTimeout(resolve, 150));

    const image = options?.image ?? "https://example.com/generated.png";
    const variations = options?.variations ?? [
      "https://example.com/generated-variation-1.png",
      "https://example.com/generated-variation-2.png",
    ];

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        image,
        variations,
      }),
    });
  });
};

export const expectSceneLifecycle = async (
  page: Page,
  prompt: string,
  lifecycle: "idle" | "queued" | "generating" | "success" | "error",
): Promise<void> => {
  await expect(
    page.locator(".scene-card").filter({ hasText: prompt }).locator(".status-pill"),
  ).toHaveText(lifecycle);
};

export const readPersistedScenes = async (page: Page): Promise<unknown[]> =>
  page.evaluate((key) => {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as {
      state?: {
        scenes?: unknown[];
      };
    };

    return parsed.state?.scenes ?? [];
  }, persistKey);
