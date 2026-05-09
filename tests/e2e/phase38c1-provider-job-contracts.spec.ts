import { expect, test } from "@playwright/test";
import {
  DefaultSceneGenerationAgent,
  type SceneGenerationAgentEvents,
} from "../../src/agents/sceneGenerationAgent";
import { DefaultScenePollingAgent } from "../../src/agents/scenePollingAgent";
import {
  HttpSceneGenerationService,
  type SceneGenerationService,
} from "../../src/services/sceneGenerationService";
import type {
  ProviderGenerationOutcome,
  ProviderJobHandle,
  ProviderJobPollResult,
  ProviderJobTerminalResult,
} from "../../src/types/providerJob";
import type {
  GeneratedScene,
  SceneGenerationPayload,
  SceneProvider,
} from "../../src/types/scene";

const payload: SceneGenerationPayload = {
  prompt: "Contract test prompt",
  style: "cinematic",
  duration: 8,
};

const successfulScene: GeneratedScene = {
  image: "https://example.com/generated.png",
  variations: [
    "https://example.com/generated-variation-1.png",
    "https://example.com/generated-variation-2.png",
  ],
};

test.describe("Phase 3.8C1 provider job service contracts", () => {
  test("submitGenerationJob can return immediate success", async () => {
    const service = new HttpSceneGenerationService({
      provider: "replicate",
      baseUrl: "https://example.com",
      generationPath: "/scenes/generate",
    });

    await withMockedFetch(async () => {
      const outcome = await service.submitGenerationJob(payload);

      expect(outcome.kind).toBe("success");
      if (outcome.kind !== "success") {
        return;
      }

      expect(outcome.provider).toBe("replicate");
      expect(outcome.scene).toEqual(successfulScene);
    }, () => jsonResponse(successfulScene));
  });

  test("submitGenerationJob can return an accepted provider job handle", async () => {
    const service = new HttpSceneGenerationService({
      provider: "replicate",
      baseUrl: "https://example.com",
      generationPath: "/scenes/generate",
    });

    await withMockedFetch(async () => {
      const outcome = await service.submitGenerationJob(payload);

      expect(outcome.kind).toBe("submitted");
      if (outcome.kind !== "submitted") {
        return;
      }

      expect(outcome.handle.provider).toBe("replicate");
      expect(outcome.handle.jobId).toBe("job-123");
      expect(outcome.handle.status).toBe("submitted");
      expect(outcome.handle.metadata?.pollAfterMs).toBe(500);
    }, () =>
      jsonResponse({
        jobId: "job-123",
        status: "submitted",
        metadata: {
          pollAfterMs: 500,
          remoteStatus: "queued",
        },
      }),
    );
  });

  test("submitGenerationJob failure remains truthful", async () => {
    const service = new HttpSceneGenerationService({
      provider: "replicate",
      baseUrl: "https://example.com",
      generationPath: "/scenes/generate",
    });

    await withMockedFetch(async () => {
      const outcome = await service.submitGenerationJob(payload);

      expect(outcome.kind).toBe("failure");
      if (outcome.kind !== "failure") {
        return;
      }

      expect(outcome.provider).toBe("replicate");
      expect(outcome.error.code).toBe("http_error");
      expect(outcome.error.message).toContain("status 502");
    }, () =>
      jsonResponse(
        {
          message: "Upstream failure",
        },
        502,
        "Bad Gateway",
      ),
    );
  });

  test("pollGenerationJob can return pending", async () => {
    const service = new HttpSceneGenerationService({
      provider: "replicate",
      baseUrl: "https://example.com",
      pollPath: "/scenes/jobs",
    });

    await withMockedFetch(async () => {
      const result = await service.pollGenerationJob({
        provider: "replicate",
        jobId: "job-123",
        status: "submitted",
      });

      expect(result.kind).toBe("pending");
      if (result.kind !== "pending") {
        return;
      }

      expect(result.handle.jobId).toBe("job-123");
      expect(result.handle.status).toBe("processing");
      expect(result.handle.metadata?.pollAfterMs).toBe(750);
    }, () =>
      jsonResponse({
        jobId: "job-123",
        status: "processing",
        metadata: {
          pollAfterMs: 750,
        },
      }),
    );
  });

  test("pollGenerationJob can return terminal success", async () => {
    const service = new HttpSceneGenerationService({
      provider: "replicate",
      baseUrl: "https://example.com",
      pollPath: "/scenes/jobs",
    });

    await withMockedFetch(async () => {
      const result = await service.pollGenerationJob({
        provider: "replicate",
        jobId: "job-123",
        status: "processing",
      });

      expect(result.kind).toBe("success");
      if (result.kind !== "success") {
        return;
      }

      expect(service.normalizeTerminalResult(result.result)).toEqual(successfulScene);
    }, () => jsonResponse(successfulScene));
  });

  test("pollGenerationJob can return terminal failure", async () => {
    const service = new HttpSceneGenerationService({
      provider: "replicate",
      baseUrl: "https://example.com",
      pollPath: "/scenes/jobs",
    });

    await withMockedFetch(async () => {
      const result = await service.pollGenerationJob({
        provider: "replicate",
        jobId: "job-123",
        status: "processing",
      });

      expect(result.kind).toBe("failure");
      if (result.kind !== "failure") {
        return;
      }

      expect(result.failure.jobId).toBe("job-123");
      expect(result.failure.error.code).toBe("provider_failed");
      expect(result.failure.error.message).toBe("Provider rejected the prompt.");
    }, () =>
      jsonResponse({
        jobId: "job-123",
        status: "failed",
        error: {
          message: "Provider rejected the prompt.",
          code: "provider_failed",
        },
      }),
    );
  });
});

test.describe("Phase 3.8C1 generation and polling agents", () => {
  test("primary submit failure may fallback to secondary submit", async () => {
    const primary = createStubService("replicate", {
      submitResult: {
        kind: "failure",
        provider: "replicate",
        error: {
          message: "Primary failed",
          code: "http_error",
        },
        metadata: {
          provider: "replicate",
        },
      },
    });
    const fallback = createStubService("gemini", {
      submitResult: {
        kind: "submitted",
        handle: {
          provider: "gemini",
          jobId: "fallback-job",
          status: "submitted",
        },
      },
    });
    const agent = new DefaultSceneGenerationAgent(primary, fallback);
    const fallbackEvents: string[] = [];

    const result = await agent.startGeneration(payload, undefined, {
      onProviderFallback: (provider) => {
        fallbackEvents.push(provider);
      },
    });

    expect(result.kind).toBe("submitted");
    expect(fallback.submitCalls).toBe(1);
    expect(fallbackEvents).toEqual(["gemini"]);
  });

  test("accepted primary job is not treated as failure and does not fallback", async () => {
    const primary = createStubService("replicate", {
      submitResult: {
        kind: "submitted",
        handle: {
          provider: "replicate",
          jobId: "primary-job",
          status: "submitted",
        },
      },
    });
    const fallback = createStubService("gemini", {
      submitResult: {
        kind: "submitted",
        handle: {
          provider: "gemini",
          jobId: "fallback-job",
          status: "submitted",
        },
      },
    });
    const agent = new DefaultSceneGenerationAgent(primary, fallback);

    const result = await agent.startGeneration(payload);

    expect(result.kind).toBe("submitted");
    expect(primary.submitCalls).toBe(1);
    expect(fallback.submitCalls).toBe(0);
  });

  test("polling agent scaffold can poll pending results until terminal success", async () => {
    const service = createPollingSequenceService("replicate", [
      {
        kind: "pending",
        handle: {
          provider: "replicate",
          jobId: "job-123",
          status: "processing",
          metadata: {
            provider: "replicate",
            pollAfterMs: 1,
          },
        },
      },
      {
        kind: "success",
        result: {
          kind: "success",
          provider: "replicate",
          scene: successfulScene,
          metadata: {
            provider: "replicate",
          },
        },
      },
    ]);
    const pollingAgent = new DefaultScenePollingAgent({
      timeoutMs: 1_000,
      pollDelayMs: 1,
    });

    const result = await pollingAgent.pollUntilTerminal(service, {
      provider: "replicate",
      jobId: "job-123",
      status: "submitted",
    });

    expect(result.kind).toBe("success");
    if (result.kind !== "success") {
      return;
    }

    expect(result.result.scene).toEqual(successfulScene);
  });
});

const jsonResponse = (
  body: unknown,
  status = 200,
  statusText = "OK",
): Response =>
  new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: {
      "Content-Type": "application/json",
    },
  });

const withMockedFetch = async (
  callback: () => Promise<void>,
  implementation: () => Response | Promise<Response>,
): Promise<void> => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => implementation()) as typeof fetch;

  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

const createStubService = (
  provider: SceneProvider,
  options: {
    submitResult: ProviderGenerationOutcome;
  },
): SceneGenerationService & { submitCalls: number } => {
  let submitCalls = 0;

  return {
    provider,
    get submitCalls() {
      return submitCalls;
    },
    async submitGenerationJob() {
      submitCalls += 1;
      return options.submitResult;
    },
    async pollGenerationJob(handle: ProviderJobHandle) {
      return {
        kind: "failure",
        failure: {
          kind: "failure",
          provider,
          jobId: handle.jobId,
          error: {
            message: "Polling not configured for this stub.",
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
          jobId: "job-123",
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
