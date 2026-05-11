import type { VideoConfig } from "remotion";

export interface RemotionBundleResult {
  serveUrl: string;
}

export interface RemotionRenderResult {
  ok: boolean;
}

export type RemotionRendererModule = typeof import("@remotion/renderer");
export type RemotionBundlerModule = typeof import("@remotion/bundler");
export type RequiredRemotionCompositionConfig = VideoConfig;
export type RemotionCompositionSelectionResult =
  | RequiredRemotionCompositionConfig
  | { id: string };

export interface RemotionBundleRuntimeInput {
  entryPoint: string;
}

export interface RemotionSelectCompositionRuntimeInput {
  serveUrl: string;
  compositionId: string;
  inputProps: unknown;
}

export interface RemotionRenderMediaRuntimeInput {
  serveUrl: string;
  composition: RemotionCompositionSelectionResult;
  codec: "h264" | "vp8";
  outputLocation: string;
  inputProps: unknown;
  signal?: AbortSignal;
}

export interface RemotionRendererRuntime {
  bundle(input: RemotionBundleRuntimeInput): Promise<RemotionBundleResult>;
  selectComposition(
    input: RemotionSelectCompositionRuntimeInput,
  ): Promise<RemotionCompositionSelectionResult>;
  renderMedia(input: RemotionRenderMediaRuntimeInput): Promise<RemotionRenderResult>;
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

export const createDefaultRemotionBundlerBoundary =
  async (): Promise<RemotionBundlerModule> => {
    const remotionBundler: RemotionBundlerModule = await import("@remotion/bundler");
    return remotionBundler;
  };

export const createDefaultRemotionRuntime = async (): Promise<RemotionRendererRuntime> => {
  const remotionRenderer: typeof import("@remotion/renderer") = await import(
    "@remotion/renderer",
  );
  const remotionBundler = await createDefaultRemotionBundlerBoundary();
  void remotionRenderer;
  void remotionBundler;

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
