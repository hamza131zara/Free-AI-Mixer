import test, { expect } from "@playwright/test";
import {
  mapRendererFailure,
  toPublicSafeRendererFailure,
} from "../../backend/renderer/rendererFailureMapping";

test.describe("phase73 renderer failure mapping", () => {
  test("maps unknown error to renderer_execution_failed", () => {
    const mapped = mapRendererFailure({
      error: new Error("unexpected renderer crash"),
      stage: "render",
      transient: false,
    });

    expect(mapped.code).toBe("renderer_execution_failed");
    expect(mapped.retryable).toBe(false);
    expect(mapped.causeCategory).toBe("runtime");
  });

  test("maps timeout-like errors to renderer_timed_out", () => {
    const mapped = mapRendererFailure({
      error: { name: "TimeoutError", message: "Render timed out" },
    });
    expect(mapped.code).toBe("renderer_timed_out");
    expect(mapped.retryable).toBe(true);
    expect(mapped.causeCategory).toBe("timeout");
  });

  test("maps abort/cancel-like errors to renderer_cancelled_or_aborted", () => {
    const mapped = mapRendererFailure({
      error: { name: "AbortError", message: "Operation aborted by caller" },
    });
    expect(mapped.code).toBe("renderer_cancelled_or_aborted");
    expect(mapped.retryable).toBe(false);
    expect(mapped.causeCategory).toBe("abort");
  });

  test("maps snapshot validation failure to input_snapshot_invalid", () => {
    const mapped = mapRendererFailure({
      error: { message: "renderInputSnapshot invalid" },
      stage: "snapshot",
    });
    expect(mapped.code).toBe("input_snapshot_invalid");
    expect(mapped.retryable).toBe(false);
    expect(mapped.causeCategory).toBe("validation");
  });

  test("maps output path errors to output_path_invalid", () => {
    const mapped = mapRendererFailure({
      error: { message: "output path traversal attempt rejected" },
      stage: "path",
    });
    expect(mapped.code).toBe("output_path_invalid");
    expect(mapped.retryable).toBe(false);
    expect(mapped.causeCategory).toBe("validation");
  });

  test("preserves artifact verification failure codes", () => {
    const codes = [
      "artifact_verification_failed",
      "artifact_file_missing",
      "artifact_file_empty",
      "artifact_format_mismatch",
    ] as const;

    for (const code of codes) {
      const mapped = mapRendererFailure({
        error: { code, message: `failure: ${code}` },
        stage: "verify",
      });
      expect(mapped.code).toBe(code);
      expect(mapped.retryable).toBe(false);
      expect(mapped.causeCategory).toBe("verification");
    }
  });

  test("retryability policy matches expected behavior", () => {
    const transientRuntime = mapRendererFailure({
      error: new Error("temporary runtime issue"),
      transient: true,
    });
    expect(transientRuntime.code).toBe("renderer_execution_failed");
    expect(transientRuntime.retryable).toBe(true);

    const writeNonTransient = mapRendererFailure({
      error: { code: "EACCES", message: "write failed" },
      transient: false,
    });
    expect(writeNonTransient.code).toBe("output_write_failed");
    expect(writeNonTransient.retryable).toBe(false);
  });

  test("public-safe failure strips stack, paths, urls, and secret-like values", () => {
    const mapped = mapRendererFailure({
      error: new Error("render failed"),
      details: {
        jobId: "job-safe-1",
        workerId: "worker-safe-1",
        attemptCount: 2,
        stage: "render",
        summary: "safe summary",
        stack: "Error: x\n at /tmp/file.ts:1",
        outputPath: "C:\\renders\\job.mp4",
        url: "https://internal.local/resource",
        downloadUrl: "https://download.local/file.mp4",
        token: "secret_token_123",
        env: "API_KEY=abc",
        argv: "--render --secret",
        rawRendererLog: "contains bearer token",
      },
    });

    const safe = toPublicSafeRendererFailure(mapped);
    expect(safe.details).toMatchObject({
      jobId: "job-safe-1",
      workerId: "worker-safe-1",
      attemptCount: 2,
      stage: "render",
      summary: "safe summary",
    });
    expect(safe.details).not.toHaveProperty("stack");
    expect(safe.details).not.toHaveProperty("outputPath");
    expect(safe.details).not.toHaveProperty("url");
    expect(safe.details).not.toHaveProperty("downloadUrl");
    expect(safe.details).not.toHaveProperty("token");
    expect(safe.details).not.toHaveProperty("env");
    expect(safe.details).not.toHaveProperty("argv");
    expect(safe.details).not.toHaveProperty("rawRendererLog");
  });

  test("mapper has no lifecycle mutation side effects and no artifact/url creation", () => {
    let markErrorCalled = false;
    const sentinel = {
      markError: () => {
        markErrorCalled = true;
      },
      message: "noop",
    };

    const mapped = mapRendererFailure({
      error: sentinel,
      details: {
        jobId: "job-no-side-effects",
        workerId: "worker-no-side-effects",
      },
    });

    expect(markErrorCalled).toBe(false);
    expect(mapped).not.toHaveProperty("progress");
    expect(mapped).not.toHaveProperty("artifacts");
    expect(mapped).not.toHaveProperty("downloadUrl");
    expect(mapped).not.toHaveProperty("publicUrl");
    expect(mapped).not.toHaveProperty("signedUrl");
  });
});
