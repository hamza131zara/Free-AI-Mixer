import type { RendererAdapter } from "./singleProcessRenderHarness";

export interface RemotionBundleResult {
  serveUrl: string;
}

export interface RemotionCompositionResult {
  id: string;
}

export interface RemotionRenderResult {
  ok: boolean;
}

export interface RemotionRendererRuntime {
  bundle(input: { entryPoint: string }): Promise<RemotionBundleResult>;
  selectComposition(input: {
    serveUrl: string;
    compositionId: string;
    inputProps: unknown;
  }): Promise<RemotionCompositionResult>;
  renderMedia(input: {
    serveUrl: string;
    composition: RemotionCompositionResult;
    codec: "h264" | "vp8";
    outputLocation: string;
    inputProps: unknown;
    signal?: AbortSignal;
  }): Promise<RemotionRenderResult>;
}

export interface RemotionRendererAdapterOptions {
  runtime?: RemotionRendererRuntime;
  entryPoint?: string;
  compositionId?: string;
  workerId?: string;
}

export const remotionRendererAdapterNotImplementedCode =
  "renderer_execution_failed" as const;

const NOT_IMPLEMENTED_MESSAGE =
  "Remotion renderer adapter is not implemented in this phase.";

const isSafePrimitive = (value: unknown): value is string | number | boolean | null =>
  value === null ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

const sanitizeDiagnostics = (
  diagnostics?: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  if (!diagnostics) {
    return undefined;
  }

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(diagnostics)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("path") ||
      lowerKey.includes("url") ||
      lowerKey.includes("download") ||
      lowerKey.includes("signed") ||
      lowerKey.includes("public") ||
      lowerKey.includes("stack") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token") ||
      lowerKey.includes("password") ||
      lowerKey.includes("env") ||
      lowerKey.includes("argv") ||
      lowerKey.includes("command") ||
      lowerKey.includes("artifact")
    ) {
      continue;
    }

    if (isSafePrimitive(value)) {
      safe[key] = value;
    }
  }

  return Object.keys(safe).length > 0 ? safe : undefined;
};

const toSafeFailureResult = (
  code: string,
  message: string,
  workerId?: string,
  diagnostics?: Record<string, unknown>,
): Awaited<ReturnType<RendererAdapter>> => ({
  ok: false,
  transient: false,
  error: {
    code,
    message,
  },
  diagnostics: {
    code,
    summary: message,
    retryable: false,
    renderer: "remotion",
    ...(workerId ? { workerId } : {}),
    ...(sanitizeDiagnostics(diagnostics) ?? {}),
  },
});

export const createRemotionRendererAdapter = (
  options?: RemotionRendererAdapterOptions,
): RendererAdapter => {
  const runtime = options?.runtime;
  const entryPoint = options?.entryPoint ?? "backend/renderer/remotion-entry.ts";
  const compositionId = options?.compositionId ?? "FreeAiMixerComposition";
  const workerId = options?.workerId;

  return async ({ snapshot, resolvedOutputPath, abortSignal }) => {
    if (!runtime) {
      return toSafeFailureResult(
        remotionRendererAdapterNotImplementedCode,
        NOT_IMPLEMENTED_MESSAGE,
        workerId,
      );
    }

    try {
      const bundleResult = await runtime.bundle({ entryPoint });
      const composition = await runtime.selectComposition({
        serveUrl: bundleResult.serveUrl,
        compositionId,
        inputProps: snapshot,
      });

      const codec = snapshot.outputTarget.format === "webm" ? "vp8" : "h264";
      const renderResult = await runtime.renderMedia({
        serveUrl: bundleResult.serveUrl,
        composition,
        codec,
        outputLocation: resolvedOutputPath.filePath,
        inputProps: snapshot,
        signal: abortSignal,
      });

      if (!renderResult.ok) {
        return toSafeFailureResult(
          "renderer_execution_failed",
          "Remotion renderer adapter reported failure.",
          workerId,
          { mocked: true },
        );
      }

      return {
        ok: true,
        diagnostics: {
          code: "renderer_execution_success",
          summary: "Remotion adapter call sequence completed.",
          renderer: "remotion",
          mocked: true,
          ...(workerId ? { workerId } : {}),
        },
      };
    } catch (error) {
      const message =
        error instanceof Error && typeof error.message === "string"
          ? error.message
          : "Remotion renderer adapter execution failed.";

      return toSafeFailureResult(
        "renderer_execution_failed",
        message,
        workerId,
        { mocked: true },
      );
    }
  };
};
