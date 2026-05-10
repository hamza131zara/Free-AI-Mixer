import type { RendererAdapter } from "./singleProcessRenderHarness";

export interface RemotionRendererAdapterOptions {
  workerId?: string;
}

export const remotionRendererAdapterNotImplementedCode =
  "renderer_execution_failed" as const;

const NOT_IMPLEMENTED_MESSAGE =
  "Remotion renderer adapter is not implemented in this phase.";

export const createRemotionRendererAdapter = (
  options?: RemotionRendererAdapterOptions,
): RendererAdapter => {
  const workerId = options?.workerId;

  return async () => ({
    ok: false,
    transient: false,
    error: {
      code: remotionRendererAdapterNotImplementedCode,
      message: NOT_IMPLEMENTED_MESSAGE,
    },
    diagnostics: {
      code: remotionRendererAdapterNotImplementedCode,
      summary: NOT_IMPLEMENTED_MESSAGE,
      retryable: false,
      ...(workerId ? { workerId } : {}),
    },
  });
};
