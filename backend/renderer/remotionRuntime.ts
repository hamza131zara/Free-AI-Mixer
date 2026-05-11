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

export interface RunRemotionRuntimeInput {
  runtime: RemotionRendererRuntime;
  entryPoint: string;
  compositionId: string;
  inputProps: unknown;
  outputLocation: string;
  codec: "h264" | "vp8";
  signal?: AbortSignal;
}

export interface RunRemotionRuntimeResult {
  ok: boolean;
}

export const createDefaultRemotionRuntime = async (): Promise<RemotionRendererRuntime> => {
  const remotionRenderer: typeof import("@remotion/renderer") = await import(
    "@remotion/renderer"
  );
  void remotionRenderer;

  return {
    async bundle() {
      throw new Error(
        "Remotion bundling is not implemented in this phase. Provide an injected runtime.",
      );
    },
    async selectComposition() {
      throw new Error(
        "Remotion composition selection is not implemented in this phase. Provide an injected runtime.",
      );
    },
    async renderMedia() {
      throw new Error(
        "Remotion renderMedia execution is not implemented in this phase. Provide an injected runtime.",
      );
    },
  };
};

export const runRemotionRuntime = async (
  input: RunRemotionRuntimeInput,
): Promise<RunRemotionRuntimeResult> => {
  const bundleResult = await input.runtime.bundle({ entryPoint: input.entryPoint });
  const composition = await input.runtime.selectComposition({
    serveUrl: bundleResult.serveUrl,
    compositionId: input.compositionId,
    inputProps: input.inputProps,
  });

  const renderResult = await input.runtime.renderMedia({
    serveUrl: bundleResult.serveUrl,
    composition,
    codec: input.codec,
    outputLocation: input.outputLocation,
    inputProps: input.inputProps,
    signal: input.signal,
  });

  return {
    ok: Boolean(renderResult.ok),
  };
};
