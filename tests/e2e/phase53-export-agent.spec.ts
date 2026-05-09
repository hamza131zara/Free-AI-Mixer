import { expect, test } from "@playwright/test";
import type {
  ExportJobHandle,
  ExportSubmissionResult,
  TimelineExportRequest,
} from "../../src/types/exportJob";

const exportRequest: TimelineExportRequest = {
  requestId: "export-request-1",
  timelineId: "timeline-1",
  renderSettings: {
    format: "mp4",
    resolution: "1080p",
    fps: 30,
    quality: "standard",
  },
  requestedAt: "2026-05-09T00:00:00.000Z",
};

const exportHandle: ExportJobHandle = {
  provider: "backend_render",
  requestId: "export-request-1",
  jobId: "job-123",
  status: "submitted",
};

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
  implementation: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>,
): Promise<void> => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
    implementation(input, init)) as typeof fetch;

  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

const loadExportAgentModule = async (
  runtimeConfig?: Record<string, unknown>,
): Promise<typeof import("../../src/agents/exportAgent")> => {
  const globalWithWindow = globalThis as typeof globalThis & {
    window?: { __FREE_AI_MIXER_RUNTIME_CONFIG__?: Record<string, unknown> };
  };

  if (runtimeConfig) {
    globalWithWindow.window = {
      __FREE_AI_MIXER_RUNTIME_CONFIG__: runtimeConfig,
    };
  } else {
    delete globalWithWindow.window;
  }

  return import(`../../src/agents/exportAgent.ts?case=${Math.random()}`);
};

test.describe("Phase 5.3 export agent orchestration", () => {
  test("startExport returns immediate success only for immediate_success submission", async () => {
    const module = await loadExportAgentModule({
      exportBaseUrl: "https://example.com",
      exportSubmitPath: "/exports/jobs",
    });
    const agent = new module.DefaultExportAgent();

    await withMockedFetch(async () => {
      const result = await agent.startExport(exportRequest);
      expect(result).toMatchObject({
        kind: "success",
        result: {
          jobId: exportHandle.jobId,
        },
      });
    }, () =>
      jsonResponse({
        kind: "immediate_success",
        result: {
          provider: "backend_render",
          requestId: exportHandle.requestId,
          jobId: exportHandle.jobId,
          artifacts: [{ id: "artifact-1" }],
        },
      }),
    );
  });

  test("startExport returns accepted_job for accepted submissions", async () => {
    const module = await loadExportAgentModule({
      exportBaseUrl: "https://example.com",
      exportSubmitPath: "/exports/jobs",
    });
    const agent = new module.DefaultExportAgent();

    await withMockedFetch(async () => {
      const result = await agent.startExport(exportRequest);
      expect(result).toMatchObject({
        kind: "accepted_job",
        handle: exportHandle,
      });
    }, () =>
      jsonResponse({
        kind: "accepted_job",
        handle: exportHandle,
      }),
    );
  });

  test("startExport returns failure for failure submissions", async () => {
    const module = await loadExportAgentModule({
      exportBaseUrl: "https://example.com",
      exportSubmitPath: "/exports/jobs",
    });
    const agent = new module.DefaultExportAgent();

    await withMockedFetch(async () => {
      const result = await agent.startExport(exportRequest);
      expect(result).toMatchObject({
        kind: "failure",
        failure: {
          code: "http_error",
        },
      });
    }, () =>
      jsonResponse(
        {
          message: "upstream failure",
        },
        502,
        "Bad Gateway",
      ),
    );
  });

  test("resolveExport returns immediate terminal result directly without polling", async () => {
    const module = await loadExportAgentModule({
      exportBaseUrl: "https://example.com",
      exportPollPath: "/exports/jobs",
    });
    const agent = new module.DefaultExportAgent();
    let fetchCalls = 0;

    await withMockedFetch(async () => {
      const submission: ExportSubmissionResult = {
        kind: "immediate_success",
        result: {
          provider: "backend_render",
          requestId: exportHandle.requestId,
          jobId: exportHandle.jobId,
          artifacts: [{ id: "artifact-1" }],
        },
      };
      const result = await agent.resolveExport(submission);
      expect(result.kind).toBe("success");
      expect(fetchCalls).toBe(0);
    }, async () => {
      fetchCalls += 1;
      return jsonResponse({ ok: true });
    });
  });

  test("resolveExport polls accepted job until terminal_success", async () => {
    const module = await loadExportAgentModule({
      exportBaseUrl: "https://example.com",
      exportPollPath: "/exports/jobs",
    });
    const agent = new module.DefaultExportAgent({ pollDelayMs: 1 });
    let pollCalls = 0;
    let submitCalls = 0;

    await withMockedFetch(async (_input, init) => {
      const method = init?.method ?? "GET";
      if (method === "POST") {
        submitCalls += 1;
      }

      const submission: ExportSubmissionResult = {
        kind: "accepted_job",
        handle: exportHandle,
      };
      const result = await agent.resolveExport(submission, { pollDelayMs: 1 });
      expect(result).toMatchObject({
        kind: "success",
        result: {
          jobId: exportHandle.jobId,
        },
      });
      expect(pollCalls).toBe(2);
      expect(submitCalls).toBe(0);
    }, (_input, init) => {
      const method = init?.method ?? "GET";
      if (method === "GET") {
        pollCalls += 1;
      }

      if (pollCalls === 1) {
        return jsonResponse({
          kind: "pending",
          handle: {
            ...exportHandle,
            status: "rendering",
          },
          progress: {
            stage: "rendering",
          },
        });
      }

      return jsonResponse({
        kind: "terminal_success",
        result: {
          provider: "backend_render",
          requestId: exportHandle.requestId,
          jobId: exportHandle.jobId,
          artifacts: [{ id: "artifact-2" }],
        },
      });
    });
  });

  test("resolveExport polls accepted job until terminal_failure", async () => {
    const module = await loadExportAgentModule({
      exportBaseUrl: "https://example.com",
      exportPollPath: "/exports/jobs",
    });
    const agent = new module.DefaultExportAgent();

    await withMockedFetch(async () => {
      const submission: ExportSubmissionResult = {
        kind: "accepted_job",
        handle: exportHandle,
      };
      const result = await agent.resolveExport(submission);
      expect(result).toMatchObject({
        kind: "failure",
        jobId: exportHandle.jobId,
        failure: {
          code: "export_failed",
        },
      });
    }, () =>
      jsonResponse({
        kind: "terminal_failure",
        jobId: exportHandle.jobId,
        failure: {
          message: "render failed",
          code: "export_failed",
        },
      }),
    );
  });

  test("pollExportUntilTerminal times out with export_poll_timeout", async () => {
    const module = await loadExportAgentModule({
      exportBaseUrl: "https://example.com",
      exportPollPath: "/exports/jobs",
    });
    const agent = new module.DefaultExportAgent({
      timeoutMs: 5,
      pollDelayMs: 2,
    });

    await withMockedFetch(async () => {
      const result = await agent.pollExportUntilTerminal(exportHandle, {
        timeoutMs: 5,
        pollDelayMs: 2,
      });
      expect(result).toMatchObject({
        kind: "failure",
        jobId: exportHandle.jobId,
        failure: {
          code: "export_poll_timeout",
        },
      });
    }, () =>
      jsonResponse({
        kind: "pending",
        handle: {
          ...exportHandle,
          status: "rendering",
        },
      }),
    );
  });

  test("transient poll failures respect retry budget", async () => {
    const module = await loadExportAgentModule({
      exportBaseUrl: "https://example.com",
      exportPollPath: "/exports/jobs",
    });
    const agent = new module.DefaultExportAgent({
      maxTransientFailures: 1,
      pollDelayMs: 1,
    });
    let pollCalls = 0;

    await withMockedFetch(async () => {
      const result = await agent.pollExportUntilTerminal(exportHandle, {
        maxTransientFailures: 1,
        pollDelayMs: 1,
      });
      expect(result).toMatchObject({
        kind: "failure",
        failure: {
          code: "transport_exception",
        },
      });
      expect(pollCalls).toBe(2);
    }, () => {
      pollCalls += 1;
      return jsonResponse({
        kind: "terminal_failure",
        jobId: exportHandle.jobId,
        failure: {
          message: "temporary transport issue",
          code: "transport_exception",
        },
      });
    });
  });

  test("AbortError is preserved and never converted to fake success", async () => {
    const module = await loadExportAgentModule({
      exportBaseUrl: "https://example.com",
      exportSubmitPath: "/exports/jobs",
      exportPollPath: "/exports/jobs",
    });
    const agent = new module.DefaultExportAgent();
    const aborted = new AbortController();
    aborted.abort();

    await withMockedFetch(
      async () => {
        await expect(
          agent.startExport(exportRequest, { signal: aborted.signal }),
        ).rejects.toMatchObject({
          name: "AbortError",
        });
      },
      async (_input, init) => {
        if (init?.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        return jsonResponse({});
      },
    );

    await withMockedFetch(
      async () => {
        await expect(
          agent.pollExportUntilTerminal(exportHandle, { signal: aborted.signal }),
        ).rejects.toMatchObject({
          name: "AbortError",
        });
      },
      async (_input, init) => {
        if (init?.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        return jsonResponse({});
      },
    );
  });
});
