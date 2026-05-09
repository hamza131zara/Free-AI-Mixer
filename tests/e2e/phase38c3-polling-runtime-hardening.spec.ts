import { expect, test } from "@playwright/test";
import { DefaultSceneGenerationAgent } from "../../src/agents/sceneGenerationAgent";
import { DefaultScenePollingAgent } from "../../src/agents/scenePollingAgent";
import {
  DefaultSceneQueueAgent,
  type SceneQueueAgentEvents,
} from "../../src/agents/sceneQueueAgent";
import type { SceneGenerationAgent } from "../../src/agents/sceneGenerationAgent";
import type { SceneGenerationService } from "../../src/services/sceneGenerationService";
import type {
  ProviderJobHandle,
  ProviderJobPollResult,
  ProviderJobTerminalResult,
} from "../../src/types/providerJob";
import type {
  GeneratedScene,
  SceneGenerationPayload,
  SceneProvider,
} from "../../src/types/scene";
import {
  expectSceneLifecycle,
  readPersistedScenes,
  sceneApiUrl,
  scenePollApiUrlPrefix,
  seedSingleIdleScene,
  setRuntimeConfig,
} from "./helpers/runtime";

const payload: SceneGenerationPayload = {
  prompt: "Hardening contract prompt",
  style: "cinematic",
  duration: 8,
};

const successfulScene: GeneratedScene = {
  image: "https://example.com/hardening-success.png",
  variations: ["https://example.com/hardening-success-variation.png"],
};

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

test.describe("Phase 3.8C3 polling runtime hardening", () => {
  test("duplicate generate clicks do not submit duplicate accepted jobs", async ({
    page,
  }) => {
    const prompt = "Duplicate accepted job guard";
    let submitCount = 0;
    let pollCount = 0;

    await setRuntimeConfig(page, {
      baseUrl: "http://127.0.0.1:4173",
      generationPath: "/scenes/generate",
      pollPath: "/scenes/jobs",
      pollDelayMs: 1,
    });
    await seedSingleIdleScene(page, prompt);

    await page.route(sceneApiUrl, async (route) => {
      submitCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-duplicate-guard",
          status: "submitted",
          metadata: {
            pollAfterMs: 1,
          },
        }),
      });
    });

    await page.route(`${scenePollApiUrlPrefix}/job-duplicate-guard`, async (route) => {
      pollCount += 1;

      if (pollCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jobId: "job-duplicate-guard",
            status: "processing",
            metadata: {
              pollAfterMs: 50,
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulScene),
      });
    });

    await gotoApp(page);

    const button = sceneCard(page, prompt).getByRole("button", {
      name: "Generate scene",
    });

    await button.evaluate((element) => {
      const buttonElement = element as HTMLButtonElement;
      buttonElement.click();
      buttonElement.click();
    });

    await expectSceneLifecycle(page, prompt, "success");
    await expect(sceneCard(page, prompt)).toContainText("Completed after provider job");
    expect(submitCount).toBe(1);
  });

  test("accepted provider job stays generating while polling and resets to idle on refresh", async ({
    page,
  }) => {
    const prompt = "Polling refresh reset scene";
    let pollCount = 0;

    await setRuntimeConfig(page, {
      baseUrl: "http://127.0.0.1:4173",
      generationPath: "/scenes/generate",
      pollPath: "/scenes/jobs",
      pollDelayMs: 1,
    });
    await seedSingleIdleScene(page, prompt);

    await page.route(sceneApiUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-refresh-reset",
          status: "submitted",
          metadata: {
            pollAfterMs: 1,
          },
        }),
      });
    });

    await page.route(`${scenePollApiUrlPrefix}/job-refresh-reset`, async (route) => {
      pollCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-refresh-reset",
          status: "processing",
          metadata: {
            pollAfterMs: 200,
          },
        }),
      });
    });

    await gotoApp(page);
    await generateScene(page, prompt);

    await expectSceneLifecycle(page, prompt, "generating");
    await expect(sceneCard(page, prompt)).toContainText("Waiting for provider");

    await page.reload();
    await expectSceneLifecycle(page, prompt, "idle");
    await expect(sceneCard(page, prompt)).toContainText("Not used");
    expect(pollCount).toBeGreaterThanOrEqual(1);
  });

  test("accepted provider job times out truthfully", async ({ page }) => {
    const prompt = "Polling timeout scene";

    await setRuntimeConfig(page, {
      baseUrl: "http://127.0.0.1:4173",
      generationPath: "/scenes/generate",
      pollPath: "/scenes/jobs",
      pollTimeoutMs: 20,
      pollDelayMs: 1,
    });
    await seedSingleIdleScene(page, prompt);

    await page.route(sceneApiUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-timeout",
          status: "submitted",
          metadata: {
            pollAfterMs: 1,
          },
        }),
      });
    });

    await page.route(`${scenePollApiUrlPrefix}/job-timeout`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-timeout",
          status: "processing",
          metadata: {
            pollAfterMs: 1,
          },
        }),
      });
    });

    await gotoApp(page);
    await generateScene(page, prompt);

    await expectSceneLifecycle(page, prompt, "error");
    await expect(sceneCard(page, prompt).locator(".error-message")).toContainText(
      "Scene generation polling timed out.",
    );
    await expect(sceneCard(page, prompt)).toContainText(
      "Timed out while waiting for provider",
    );

    const scenes = (await readPersistedScenes(page)) as Array<{
      error?: { code?: string };
    }>;
    expect(scenes[0]?.error?.code).toBe("provider_poll_timeout");
  });

  test("transient poll failures retry within budget and still succeed", async ({
    page,
  }) => {
    const prompt = "Transient poll retry scene";
    let pollCount = 0;

    await setRuntimeConfig(page, {
      baseUrl: "http://127.0.0.1:4173",
      generationPath: "/scenes/generate",
      pollPath: "/scenes/jobs",
      pollDelayMs: 1,
      maxTransientPollFailures: 2,
    });
    await seedSingleIdleScene(page, prompt);

    await page.route(sceneApiUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-transient-retry",
          status: "submitted",
          metadata: {
            pollAfterMs: 1,
          },
        }),
      });
    });

    await page.route(`${scenePollApiUrlPrefix}/job-transient-retry`, async (route) => {
      pollCount += 1;

      if (pollCount <= 2) {
        await route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({
            message: `Temporary upstream issue ${pollCount}`,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successfulScene),
      });
    });

    await gotoApp(page);
    await generateScene(page, prompt);

    await expectSceneLifecycle(page, prompt, "success");
    await expect(sceneCard(page, prompt)).toContainText("Completed after provider job");
    expect(pollCount).toBe(3);
  });
});

test.describe("Phase 3.8C3 agent hardening", () => {
  test("accepted job does not fallback after acceptance even when polling fails", async () => {
    const primary = createPollingSequenceService("replicate", [
      {
        kind: "failure",
        failure: {
          kind: "failure",
          provider: "replicate",
          jobId: "job-no-fallback",
          error: {
            message: "Provider failed after acceptance.",
            code: "provider_failed",
          },
          metadata: {
            provider: "replicate",
          },
        },
      },
    ]);
    const fallback = createSubmitCountingService("gemini");
    const pollingAgent = new DefaultScenePollingAgent({
      timeoutMs: 100,
      pollDelayMs: 1,
    });
    const agent = new DefaultSceneGenerationAgent(primary, fallback, pollingAgent);

    const outcome = await agent.startGeneration(payload);
    await expect(agent.resolveGeneration(outcome)).rejects.toMatchObject({
      code: "provider_failed",
    });
    expect(fallback.submitCalls).toBe(0);
  });

  test("queue concurrency stays bounded while accepted jobs are polling", async () => {
    const releases = new Map<string, () => void>();
    const started: string[] = [];

    const generationAgent: SceneGenerationAgent = {
      createPayload: (draft) => ({
        prompt: draft.prompt,
      }),
      async startGeneration(jobPayload) {
        const prompt = jobPayload.prompt;
        started.push(`start:${prompt}`);
        return {
          kind: "submitted",
          handle: {
            provider: "replicate",
            jobId: `job-${prompt}`,
            status: "submitted",
          },
        };
      },
      async resolveGeneration(outcome) {
        if (outcome.kind !== "submitted") {
          throw new Error("Expected submitted job.");
        }

        await new Promise<void>((resolve) => {
          releases.set(outcome.handle.jobId, resolve);
        });

        return {
          provider: outcome.handle.provider,
          scene: {
            image: `https://example.com/${outcome.handle.jobId}.png`,
            variations: [],
          },
        };
      },
      async generateScene() {
        return {
          provider: "replicate",
          scene: successfulScene,
        };
      },
    };

    const queueAgent = new DefaultSceneQueueAgent(generationAgent, 2);
    const completed: string[] = [];

    const runPromise = queueAgent.generateAll(
      [
        { id: "scene-1", payload: { prompt: "one" } },
        { id: "scene-2", payload: { prompt: "two" } },
        { id: "scene-3", payload: { prompt: "three" } },
      ],
      createNoopQueueEvents({
        onSuccess: (sceneId) => {
          completed.push(sceneId);
        },
      }),
    );

    await waitForMicrotasks();
    expect(started).toEqual(["start:one", "start:two"]);

    releases.get("job-one")?.();
    await waitForCondition(() => started.includes("start:three"));
    expect(started).toContain("start:three");

    releases.get("job-two")?.();
    releases.get("job-three")?.();
    await runPromise;

    expect(completed).toEqual(["scene-1", "scene-2", "scene-3"]);
  });

  test("terminal callbacks are applied once per scene", async () => {
    const generationAgent: SceneGenerationAgent = {
      createPayload: (draft) => ({
        prompt: draft.prompt,
      }),
      async startGeneration() {
        return {
          kind: "success",
          provider: "replicate",
          scene: successfulScene,
          metadata: {
            provider: "replicate",
          },
        };
      },
      async resolveGeneration() {
        return {
          provider: "replicate",
          scene: successfulScene,
        };
      },
      async generateScene() {
        return {
          provider: "replicate",
          scene: successfulScene,
        };
      },
    };

    const queueAgent = new DefaultSceneQueueAgent(generationAgent, 1);
    let successCount = 0;
    let errorCount = 0;

    await queueAgent.generateAll(
      [{ id: "single-scene", payload: { prompt: "once" } }],
      createNoopQueueEvents({
        onSuccess: () => {
          successCount += 1;
        },
        onError: () => {
          errorCount += 1;
        },
      }),
    );

    expect(successCount).toBe(1);
    expect(errorCount).toBe(0);
  });

  test("terminal failure is applied once per scene", async () => {
    const generationAgent: SceneGenerationAgent = {
      createPayload: (draft) => ({
        prompt: draft.prompt,
      }),
      async startGeneration() {
        return {
          kind: "submitted",
          handle: {
            provider: "replicate",
            jobId: "job-fail-once",
            status: "submitted",
          },
        };
      },
      async resolveGeneration() {
        throw new Error("Polling failed once.");
      },
      async generateScene() {
        return {
          provider: "replicate",
          scene: successfulScene,
        };
      },
    };

    const queueAgent = new DefaultSceneQueueAgent(generationAgent, 1);
    let successCount = 0;
    let errorCount = 0;

    await queueAgent.generateAll(
      [{ id: "single-scene-fail", payload: { prompt: "once-fail" } }],
      createNoopQueueEvents({
        onSuccess: () => {
          successCount += 1;
        },
        onError: () => {
          errorCount += 1;
        },
      }),
    );

    expect(successCount).toBe(0);
    expect(errorCount).toBe(1);
  });
});

const createSubmitCountingService = (
  provider: SceneProvider,
): SceneGenerationService & { submitCalls: number } => {
  let submitCalls = 0;

  return {
    provider,
    get submitCalls() {
      return submitCalls;
    },
    async submitGenerationJob() {
      submitCalls += 1;
      return {
        kind: "submitted",
        handle: {
          provider,
          jobId: `${provider}-submitted`,
          status: "submitted",
        },
      };
    },
    async pollGenerationJob(handle: ProviderJobHandle) {
      return {
        kind: "failure",
        failure: {
          kind: "failure",
          provider,
          jobId: handle.jobId,
          error: {
            message: "Unexpected poll.",
            code: "unexpected_poll",
          },
          metadata: {
            provider,
          },
        },
      };
    },
    normalizeTerminalResult(result: ProviderJobTerminalResult) {
      return result.scene;
    },
    async generateScene() {
      return successfulScene;
    },
  };
};

const createPollingSequenceService = (
  provider: SceneProvider,
  pollResults: ProviderJobPollResult[],
): SceneGenerationService => {
  let pollIndex = 0;

  return {
    provider,
    async submitGenerationJob() {
      return {
        kind: "submitted",
        handle: {
          provider,
          jobId: "job-no-fallback",
          status: "submitted",
        },
      };
    },
    async pollGenerationJob() {
      const result =
        pollResults[pollIndex] ?? pollResults[pollResults.length - 1];
      pollIndex += 1;
      return result;
    },
    normalizeTerminalResult(result: ProviderJobTerminalResult) {
      return result.scene;
    },
    async generateScene() {
      return successfulScene;
    },
  };
};

const createNoopQueueEvents = (
  overrides: Partial<SceneQueueAgentEvents> = {},
): SceneQueueAgentEvents => ({
  onQueued: () => undefined,
  onGenerating: () => undefined,
  onProgress: () => undefined,
  onProviderChange: () => undefined,
  onProviderFallback: () => undefined,
  onSuccess: () => undefined,
  onError: () => undefined,
  ...overrides,
});

const waitForMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const waitForCondition = async (
  predicate: () => boolean,
  timeoutMs = 1_000,
): Promise<void> => {
  const startedAt = Date.now();

  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out while waiting for condition.");
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};
