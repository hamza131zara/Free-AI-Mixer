import type { RendererAdapter } from "./singleProcessRenderHarness";
import {
  runRemotionRuntime,
  type RemotionRendererRuntime,
} from "./remotionRuntime";
import {
  FREE_MIXER_COMPOSITION_ID,
  toFreeMixerCompositionProps,
} from "./compositions/compositionProps";
export type { RemotionRendererRuntime } from "./remotionRuntime";

export interface RemotionRendererAdapterOptions {
  runtime?: RemotionRendererRuntime;
  entryPoint?: string;
  compositionId?: string;
  workerId?: string;
  runtimeExecutor?: typeof runRemotionRuntime;
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
  const runtimeExecutor = options?.runtimeExecutor ?? runRemotionRuntime;
  const entryPoint =
    options?.entryPoint ?? "backend/renderer/compositions/remotionEntry.tsx";
  const compositionId = options?.compositionId ?? FREE_MIXER_COMPOSITION_ID;
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
      const codec = snapshot.outputTarget.format === "webm" ? "vp8" : "h264";
      const compositionProps = toFreeMixerCompositionProps(snapshot);

      const runtimeResult = await runtimeExecutor({
        runtime,
        entryPoint,
        compositionId,
        inputProps: compositionProps,
        outputLocation: resolvedOutputPath.filePath,
        codec,
        signal: abortSignal,
      });

      if (!runtimeResult.ok) {
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
