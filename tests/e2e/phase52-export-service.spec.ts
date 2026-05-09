import { expect, test } from "@playwright/test";
import type { ExportJobHandle, TimelineExportRequest } from "../../src/types/exportJob";

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
  status: "rendering",
};

type ExportServiceModule = typeof import("../../src/services/exportService");

const loadExportService = async (
  runtimeConfig?: Record<string, unknown>,
): Promise<ExportServiceModule> => {
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

  return import(`../../src/services/exportService.ts?case=${Math.random()}`);
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

test.describe("Phase 5.2 export service contracts", () => {
  test("submitExportJob returns accepted_job when backend returns accepted handle", async () => {
    const service = await loadExportService({
      exportBaseUrl: "https://example.com",
      exportSubmitPath: "/exports/jobs",
    });

    await withMockedFetch(async () => {
      const result = await service.submitExportJob(exportRequest);

      expect(result.kind).toBe("accepted_job");
      if (result.kind !== "accepted_job") {
        return;
      }

      expect(result.handle).toEqual(exportHandle);
    }, () =>
      jsonResponse({
        kind: "accepted_job",
        handle: exportHandle,
      }),
    );
  });

  test("submitExportJob returns immediate_success only when backend explicitly returns terminal success", async () => {
    const service = await loadExportService({
      exportBaseUrl: "https://example.com",
      exportSubmitPath: "/exports/jobs",
    });

    await withMockedFetch(async () => {
      const result = await service.submitExportJob(exportRequest);

      expect(result.kind).toBe("immediate_success");
      if (result.kind !== "immediate_success") {
        return;
      }

      expect(result.result.jobId).toBe("job-123");
      expect(result.result.artifacts).toEqual([{ id: "artifact-1" }]);
    }, () =>
      jsonResponse({
        kind: "immediate_success",
        result: {
          provider: "backend_render",
          requestId: "export-request-1",
          jobId: "job-123",
          artifacts: [{ id: "artifact-1" }],
        },
      }),
    );
  });

  test("submitExportJob returns truthful failure for missing API base URL", async () => {
    const service = await loadExportService();
    const result = await service.submitExportJob(exportRequest);

    expect(result).toMatchObject({
      kind: "failure",
      failure: {
        code: "missing_export_api_base_url",
      },
    });
  });

  test("submitExportJob returns failure for non-OK HTTP and invalid payload", async () => {
    const service = await loadExportService({
      exportBaseUrl: "https://example.com",
      exportSubmitPath: "/exports/jobs",
    });

    await withMockedFetch(async () => {
      const httpFailure = await service.submitExportJob(exportRequest);
      expect(httpFailure).toMatchObject({
        kind: "failure",
        failure: {
          code: "http_error",
        },
      });
    }, () =>
      jsonResponse(
        {
          message: "upstream error",
        },
        502,
        "Bad Gateway",
      ),
    );

    await withMockedFetch(async () => {
      const invalidPayloadFailure = await service.submitExportJob(exportRequest);
      expect(invalidPayloadFailure).toMatchObject({
        kind: "failure",
        failure: {
          code: "invalid_response_payload",
        },
      });
    }, () => jsonResponse({ ok: true }));
  });

  test("pollExportJob returns pending, terminal_success, and terminal_failure", async () => {
    const service = await loadExportService({
      exportBaseUrl: "https://example.com",
      exportPollPath: "/exports/jobs",
    });

    await withMockedFetch(async () => {
      const pending = await service.pollExportJob(exportHandle);
      expect(pending.kind).toBe("pending");
      if (pending.kind !== "pending") {
        return;
      }

      expect(pending.handle).toEqual(exportHandle);
      expect(pending.progress?.stage).toBe("rendering");
      expect(pending.progress?.percent).toBeUndefined();
    }, () =>
      jsonResponse({
        kind: "pending",
        handle: exportHandle,
        progress: {
          stage: "rendering",
        },
      }),
    );

    await withMockedFetch(async () => {
      const success = await service.pollExportJob(exportHandle);
      expect(success.kind).toBe("terminal_success");
      if (success.kind !== "terminal_success") {
        return;
      }

      expect(success.result.artifacts).toEqual([{ id: "artifact-success" }]);
    }, () =>
      jsonResponse({
        kind: "terminal_success",
        result: {
          provider: "backend_render",
          requestId: exportHandle.requestId,
          jobId: exportHandle.jobId,
          artifacts: [{ id: "artifact-success" }],
        },
      }),
    );

    await withMockedFetch(async () => {
      const failure = await service.pollExportJob(exportHandle);
      expect(failure).toMatchObject({
        kind: "terminal_failure",
        failure: {
          code: "render_failed",
        },
      });
    }, () =>
      jsonResponse({
        kind: "terminal_failure",
        failure: {
          message: "render failed",
          code: "render_failed",
        },
      }),
    );
  });

  test("pollExportJob maps 404 to export_job_not_found", async () => {
    const service = await loadExportService({
      exportBaseUrl: "https://example.com",
      exportPollPath: "/exports/jobs",
    });

    await withMockedFetch(async () => {
      const failure = await service.pollExportJob(exportHandle);
      expect(failure).toMatchObject({
        kind: "terminal_failure",
        jobId: exportHandle.jobId,
        failure: {
          code: "export_job_not_found",
        },
      });
    }, () =>
      jsonResponse(
        {
          message: "not found",
        },
        404,
        "Not Found",
      ),
    );
  });

  test("getExportArtifactInfo returns backend artifact refs only and never fabricates URLs", async () => {
    const service = await loadExportService({
      exportBaseUrl: "https://example.com",
      exportArtifactsPath: "/exports/jobs",
    });

    await withMockedFetch(async () => {
      const result = await service.getExportArtifactInfo(exportHandle);
      expect(result.kind).toBe("success");
      if (result.kind !== "success") {
        return;
      }

      expect(result.artifacts).toEqual([
        { id: "artifact-a" },
        { id: "artifact-b", url: "https://example.com/video.webm" },
      ]);
      expect(result.artifacts[0].url).toBeUndefined();
    }, () =>
      jsonResponse({
        artifacts: [
          { id: "artifact-a" },
          { id: "artifact-b", url: "https://example.com/video.webm" },
        ],
      }),
    );

    await withMockedFetch(async () => {
      const invalidPayload = await service.getExportArtifactInfo(exportHandle);
      expect(invalidPayload).toMatchObject({
        kind: "failure",
        failure: {
          code: "invalid_response_payload",
        },
      });
    }, () =>
      jsonResponse({
        artifacts: [{ url: "https://example.com/no-id.mp4" }],
      }),
    );
  });

  test("submitExportJob maps thrown network failure to transport_exception", async () => {
    const service = await loadExportService({
      exportBaseUrl: "https://example.com",
      exportSubmitPath: "/exports/jobs",
    });

    await withMockedFetch(async () => {
      const result = await service.submitExportJob(exportRequest);
      expect(result).toMatchObject({
        kind: "failure",
        failure: {
          code: "transport_exception",
        },
      });
    }, async () => {
      throw new Error("socket hang up");
    });
  });

  test("pollExportJob maps thrown network failure to terminal_failure with transport_exception", async () => {
    const service = await loadExportService({
      exportBaseUrl: "https://example.com",
      exportPollPath: "/exports/jobs",
    });

    await withMockedFetch(async () => {
      const result = await service.pollExportJob(exportHandle);
      expect(result).toMatchObject({
        kind: "terminal_failure",
        jobId: exportHandle.jobId,
        failure: {
          code: "transport_exception",
        },
      });
    }, async () => {
      throw new Error("connection reset");
    });
  });

  test("getExportArtifactInfo maps thrown network failure to truthful failure", async () => {
    const service = await loadExportService({
      exportBaseUrl: "https://example.com",
      exportArtifactsPath: "/exports/jobs",
    });

    await withMockedFetch(async () => {
      const result = await service.getExportArtifactInfo(exportHandle);
      expect(result).toMatchObject({
        kind: "failure",
        failure: {
          code: "transport_exception",
        },
      });
    }, async () => {
      throw new Error("network offline");
    });
  });

  test("AbortError is surfaced truthfully and never converted to fake success", async () => {
    const service = await loadExportService({
      exportBaseUrl: "https://example.com",
      exportSubmitPath: "/exports/jobs",
      exportPollPath: "/exports/jobs",
      exportArtifactsPath: "/exports/jobs",
    });

    await withMockedFetch(
      async () => {
        await expect(service.submitExportJob(exportRequest)).rejects.toMatchObject({
          name: "AbortError",
        });
      },
      async () => {
        throw new DOMException("Aborted", "AbortError");
      },
    );

    await withMockedFetch(
      async () => {
        await expect(service.pollExportJob(exportHandle)).rejects.toMatchObject({
          name: "AbortError",
        });
      },
      async () => {
        throw new DOMException("Aborted", "AbortError");
      },
    );

    await withMockedFetch(
      async () => {
        await expect(
          service.getExportArtifactInfo(exportHandle),
        ).rejects.toMatchObject({
          name: "AbortError",
        });
      },
      async () => {
        throw new DOMException("Aborted", "AbortError");
      },
    );
  });
});
