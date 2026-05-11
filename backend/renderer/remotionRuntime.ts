import type { VideoConfig } from "remotion";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  getCompositions,
  makeCancelSignal,
  openBrowser,
  renderMedia,
  selectComposition,
  type BrowserLog,
  type HeadlessBrowser,
} from "@remotion/renderer";
import { mapRendererFailure, toPublicSafeRendererFailure } from "./rendererFailureMapping";

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

export interface RealRemotionSmokeInput {
  entryPoint: string;
  compositionId: string;
  inputProps: Record<string, unknown>;
  outputLocation: string;
  codec: "h264" | "vp8";
  timeoutInMilliseconds?: number;
  logLevel?: "error" | "warn" | "info" | "verbose" | "trace";
  abortSignal?: AbortSignal;
  bundleTimeoutMs?: number;
  selectCompositionTimeoutMs?: number;
  renderMediaTimeoutMs?: number;
}

export type RealRemotionSmokeResult =
  | {
      ok: true;
      serveUrl: string;
      composition: RequiredRemotionCompositionConfig;
      outputLocation: string;
    }
  | {
      ok: false;
      failure: ReturnType<typeof toPublicSafeRendererFailure>;
    };

type RealSmokeStep =
  | "ensureBrowser"
  | "openBrowser"
  | "bundle"
  | "getCompositions"
  | "selectComposition"
  | "renderMedia";

const isSafePrimitive = (
  value: unknown,
): value is string | number | boolean | null =>
  value === null ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

const sanitizeRuntimeDetails = (
  details: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    const lowered = key.toLowerCase();

    if (lowered === "safebrowserlogsummary" && isSafePrimitive(value)) {
      safe[key] = value;
      continue;
    }

    if (
      lowered.includes("path") ||
      lowered.includes("stack") ||
      lowered.includes("url") ||
      lowered.includes("download") ||
      lowered.includes("signed") ||
      lowered.includes("public") ||
      lowered.includes("token") ||
      lowered.includes("secret") ||
      lowered.includes("password") ||
      lowered.includes("env") ||
      lowered.includes("argv") ||
      lowered.includes("command") ||
      lowered.includes("log")
    ) {
      continue;
    }

    if (isSafePrimitive(value)) {
      safe[key] = value;
    }
  }

  return Object.keys(safe).length > 0 ? safe : undefined;
};

const sanitizeCauseText = (value: string): string => {
  const withoutUrls = value.replace(
    /[a-zA-Z][a-zA-Z\d+\-.]*:\/\/\S+/g,
    "[redacted-url]",
  );
  const withoutWindowsPaths = withoutUrls.replace(
    /[A-Za-z]:\\[^\s"']+/g,
    "[redacted-path]",
  );
  const withoutUnixPaths = withoutWindowsPaths.replace(
    /(?:^|\s)\/[^\s"']+/g,
    " [redacted-path]",
  );
  const withoutSecrets = withoutUnixPaths.replace(
    /\b(token|secret|password|apikey|api_key)\s*[:=]\s*([^\s,;]+)/gi,
    "$1=[redacted]",
  );
  const singleLine = withoutSecrets.replace(/\s+/g, " ").trim();

  return singleLine.length > 220 ? `${singleLine.slice(0, 220)}...` : singleLine;
};

const classifySafeCause = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const text = value.toLowerCase();

  if (text.includes("timed out") || text.includes("timeout")) {
    return "renderer_timeout";
  }

  if (text.includes("composition") && text.includes("not")) {
    return "composition_not_registered";
  }

  if (text.includes("ffmpeg") || text.includes("codec")) {
    return "codec_or_ffmpeg_issue";
  }

  if (text.includes("chrome") || text.includes("browser")) {
    return "browser_runtime_issue";
  }

  if (text.includes("props") || text.includes("input")) {
    return "input_props_or_option_shape_issue";
  }

  if (text.includes("write") || text.includes("eacces") || text.includes("enospc")) {
    return "output_write_issue";
  }

  return "renderer_execution_issue";
};

const extractSafeCause = (
  error: unknown,
): { safeCauseSummary?: string; safeCauseName?: string; safeCauseCode?: string } => {
  if (!error || typeof error !== "object") {
    return {};
  }

  const typed = error as Record<string, unknown>;
  const rawName = typeof typed.name === "string" ? typed.name : undefined;
  const rawMessage = typeof typed.message === "string" ? typed.message : undefined;

  const safeCauseName =
    rawName && /^[A-Za-z0-9_-]{1,60}$/.test(rawName) ? rawName : undefined;
  const safeCauseSummary = rawMessage ? sanitizeCauseText(rawMessage) : undefined;
  const safeCauseCode = classifySafeCause(safeCauseSummary);

  return {
    ...(safeCauseName ? { safeCauseName } : {}),
    ...(safeCauseSummary ? { safeCauseSummary } : {}),
    ...(safeCauseCode ? { safeCauseCode } : {}),
  };
};

const toFailure = (
  stage: "snapshot" | "path" | "render" | "verify" | "finalize",
  error: unknown,
  details?: Record<string, unknown>,
): RealRemotionSmokeResult => {
  const cause = extractSafeCause(error);
  const retryable =
    typeof details?.retryable === "boolean" ? details.retryable : stage === "render";

  const mapped = mapRendererFailure({
    stage,
    error: new Error("Remotion real smoke execution failed."),
    transient: retryable,
    details: sanitizeRuntimeDetails({
      ...(details ?? {}),
      retryable,
      ...cause,
    }),
  });

  return {
    ok: false,
    failure: toPublicSafeRendererFailure(mapped),
  };
};

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

export const runRealRemotionSmokeTestOnly = async (
  input: RealRemotionSmokeInput,
): Promise<RealRemotionSmokeResult> => {
  const browserLogs: string[] = [];

  const withStepTimeout = async <T>(
    step: RealSmokeStep,
    timeoutMs: number,
    action: () => Promise<T>,
  ): Promise<T> => {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`${step} timed out`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([action(), timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  };

  try {
    const cancelController = makeCancelSignal();
    let browser: HeadlessBrowser | null = null;

    const timer =
      typeof input.timeoutInMilliseconds === "number" && input.timeoutInMilliseconds > 0
        ? setTimeout(() => {
            cancelController.cancel();
          }, input.timeoutInMilliseconds)
        : null;

    try {
      if (input.abortSignal) {
        if (input.abortSignal.aborted) {
          cancelController.cancel();
        } else {
          const onAbort = () => cancelController.cancel();
          input.abortSignal.addEventListener("abort", onAbort, { once: true });
        }
      }

      const overallTimeout = input.timeoutInMilliseconds ?? 45000;
      const bundleTimeoutMs =
        input.bundleTimeoutMs ?? Math.min(60000, Math.max(15000, overallTimeout));
      const selectTimeoutMs =
        input.selectCompositionTimeoutMs ??
        Math.min(30000, Math.max(10000, Math.floor(overallTimeout / 2)));
      const renderTimeoutMs =
        input.renderMediaTimeoutMs ?? Math.min(60000, Math.max(15000, overallTimeout));

      const onBrowserLog = (log: BrowserLog) => {
        const type = typeof log.type === "string" ? log.type : "log";
        const text = sanitizeCauseText(
          typeof log.text === "string" ? log.text : "browser-log",
        );

        browserLogs.push(`${type}:${text}`);

        if (browserLogs.length > 10) {
          browserLogs.splice(0, browserLogs.length - 10);
        }
      };
await withStepTimeout("ensureBrowser", selectTimeoutMs, () =>
  ensureBrowser({
    logLevel: input.logLevel ?? "error",
    chromeMode: "headless-shell",
  }),
);

browser = await withStepTimeout("openBrowser", selectTimeoutMs, () =>
  openBrowser("chrome", {
    logLevel: input.logLevel ?? "error",
    chromeMode: "headless-shell",
  }),
      // await withStepTimeout("ensureBrowser", selectTimeoutMs, () =>
      //   ensureBrowser({
      //     logLevel: input.logLevel ?? "error",
      //     chromeMode: "chrome-for-testing",
      //   }),
      // );

      // browser = await withStepTimeout("openBrowser", selectTimeoutMs, () =>
      //   openBrowser("chrome", {
      //     logLevel: input.logLevel ?? "error",
      //     chromeMode: "chrome-for-testing",
      //   }),
      );

      const serveUrl = await withStepTimeout("bundle", bundleTimeoutMs, () =>
        bundle({
          entryPoint: input.entryPoint,
          onProgress: () => undefined,
        }),
      );

      const compositionList = await withStepTimeout("getCompositions", selectTimeoutMs, () =>
        getCompositions(serveUrl, {
          inputProps: input.inputProps,
          puppeteerInstance: browser ?? undefined,
          onBrowserLog,
          logLevel: input.logLevel ?? "error",
          timeoutInMilliseconds: selectTimeoutMs,
        }),
      );

      const compositionExists = compositionList.some(
        (composition) => composition.id === input.compositionId,
      );

      if (!compositionExists) {
        return toFailure("render", new Error("composition_not_registered"), {
          stage: "real-smoke",
          renderer: "remotion",
          retryable: false,
          safeCauseSummary:
            "Requested composition id was not found in bundled Remotion root.",
          safeCauseCode: "composition_not_registered",
          ...(browserLogs.length > 0
            ? { safeBrowserLogSummary: browserLogs.slice(0, 3).join(" | ") }
            : {}),
        });
      }

      const composition = await withStepTimeout("selectComposition", selectTimeoutMs, () =>
        selectComposition({
          serveUrl,
          id: input.compositionId,
          inputProps: input.inputProps,
          puppeteerInstance: browser ?? undefined,
          onBrowserLog,
          logLevel: input.logLevel ?? "error",
          timeoutInMilliseconds: selectTimeoutMs,
        }),
      );

      await withStepTimeout("renderMedia", renderTimeoutMs, () =>
        renderMedia({
          serveUrl,
          composition,
          codec: input.codec,
          outputLocation: input.outputLocation,
          inputProps: input.inputProps,
          logLevel: input.logLevel ?? "error",
          timeoutInMilliseconds: renderTimeoutMs,
          cancelSignal: cancelController.cancelSignal,
          puppeteerInstance: browser ?? undefined,
          onBrowserLog,
          concurrency: 1,
          frameRange: [0, 0],
          muted: true,
        }),
      );

      return {
        ok: true,
        serveUrl,
        composition,
        outputLocation: input.outputLocation,
      };
    } finally {
      if (browser) {
        await Promise.race([
          browser.close({ silent: true }),
          new Promise<void>((resolve) => {
            setTimeout(() => resolve(), 10000);
          }),
        ]);
      }

      if (timer) {
        clearTimeout(timer);
      }
    }
  } catch (error) {
    return toFailure("render", error, {
      stage: "real-smoke",
      renderer: "remotion",
      retryable: false,
      step: "bundle/select/render",
      ...(browserLogs.length > 0
        ? { safeBrowserLogSummary: browserLogs.slice(0, 3).join(" | ") }
        : {}),
    });
  }
};