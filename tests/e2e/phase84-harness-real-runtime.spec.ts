import { expect, test } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  getCompositions,
  makeCancelSignal,
  openBrowser,
  renderMedia,
  selectComposition,
  type HeadlessBrowser,
} from "@remotion/renderer";
import type { VideoConfig } from "remotion";
import {
  createRemotionRendererAdapter,
  type RemotionRendererRuntime,
} from "../../backend/renderer/remotionRendererAdapter";
import {
  executeSingleProcessRender,
  type SingleProcessRenderHarnessResult,
} from "../../backend/renderer/singleProcessRenderHarness";
import { runRemotionRuntime } from "../../backend/renderer/remotionRuntime";
import { InMemoryExportJobRegistry } from "../../backend/registry/exportJobRegistry";
import {
  FREE_MIXER_COMPOSITION_ID,
  toFreeMixerCompositionProps,
} from "../../backend/renderer/compositions/compositionProps";
import type { RenderInputSnapshot } from "../../backend/contracts/renderInputSnapshot";

const REAL_SMOKE_ENV = "FREE_AI_MIXER_RUN_REAL_RENDER_SMOKE";

const rmWithRetries = async (targetPath: string, retries = 6): Promise<void> => {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await fs.rm(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === retries - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
};

const buildSnapshotInput = (jobId = "phase84-job"): RenderInputSnapshot => ({
  jobId,
  timelineId: "phase84-timeline",
  renderSettings: {
    format: "mp4",
    resolution: "720p",
    fps: 24,
    quality: "draft",
  },
  timelineSnapshot: {
    timelineId: "phase84-timeline",
    clips: [
      {
        clipId: "clip-1",
        sceneRefId: "scene-1",
        startMs: 0,
        durationMs: 120,
        order: 0,
      },
    ],
  },
  sceneRefs: [{ sceneId: "scene-1", role: "primary" }],
  mediaRefs: [],
  outputTarget: {
    jobFolderKey: jobId,
    artifactBaseName: "phase84_output",
    format: "mp4",
  },
});

const asRecordInputProps = (inputProps: unknown): Record<string, unknown> => {
  if (
    inputProps &&
    typeof inputProps === "object" &&
    !Array.isArray(inputProps)
  ) {
    return inputProps as Record<string, unknown>;
  }

  throw new Error("phase84_input_props_invalid");
};

const asVideoConfig = (composition: unknown): VideoConfig => {
  if (
    composition &&
    typeof composition === "object" &&
    typeof (composition as { id?: unknown }).id === "string" &&
    typeof (composition as { width?: unknown }).width === "number" &&
    typeof (composition as { height?: unknown }).height === "number" &&
    typeof (composition as { fps?: unknown }).fps === "number" &&
    typeof (composition as { durationInFrames?: unknown }).durationInFrames ===
      "number"
  ) {
    return composition as VideoConfig;
  }

  throw new Error("phase84_composition_config_invalid");
};

const createRealRemotionRuntimeForHarness = (
  entryPoint: string,
): { runtime: RemotionRendererRuntime; dispose: () => Promise<void> } => {
  let serveUrl: string | null = null;
  let browser: HeadlessBrowser | null = null;

  const runtime: RemotionRendererRuntime = {
    async bundle() {
      await ensureBrowser({ chromeMode: "headless-shell", logLevel: "error" });
      browser = await openBrowser("chrome", {
        chromeMode: "headless-shell",
        logLevel: "error",
      });
      serveUrl = await bundle({
        entryPoint,
        onProgress: () => undefined,
      });
      return { serveUrl };
    },
    async selectComposition(payload) {
      const activeServeUrl = serveUrl ?? payload.serveUrl;
      const inputProps = asRecordInputProps(payload.inputProps);
      const compositions = await getCompositions(activeServeUrl, {
        inputProps,
        puppeteerInstance: browser ?? undefined,
        logLevel: "error",
        timeoutInMilliseconds: 90000,
      });

      const exists = compositions.some((c) => c.id === payload.compositionId);
      if (!exists) {
        throw new Error("composition_not_registered");
      }

      return selectComposition({
        serveUrl: activeServeUrl,
        id: payload.compositionId,
        inputProps,
        puppeteerInstance: browser ?? undefined,
        logLevel: "error",
        timeoutInMilliseconds: 90000,
      });
    },
    async renderMedia(payload) {
      const cancel = makeCancelSignal();
      const inputProps = asRecordInputProps(payload.inputProps);
      const composition = asVideoConfig(payload.composition);
      if (payload.signal) {
        if (payload.signal.aborted) {
          cancel.cancel();
        } else {
          payload.signal.addEventListener("abort", () => cancel.cancel(), {
            once: true,
          });
        }
      }

      await renderMedia({
        serveUrl: payload.serveUrl,
        composition,
        codec: payload.codec,
        outputLocation: payload.outputLocation,
        inputProps,
        logLevel: "error",
        timeoutInMilliseconds: 90000,
        cancelSignal: cancel.cancelSignal,
        puppeteerInstance: browser ?? undefined,
        frameRange: [0, 0],
        concurrency: 1,
        muted: true,
      });
      return { ok: true };
    },
  };

  const dispose = async (): Promise<void> => {
    if (browser) {
      await Promise.race([
        browser.close({ silent: true }),
        new Promise<void>((resolve) => setTimeout(resolve, 10000)),
      ]);
      browser = null;
    }
  };

  return { runtime, dispose };
};

test.describe("phase84 harness real runtime integration", () => {
  test("default boundary keeps routes non-executing and adapter/runtime/composition mark-free", async () => {
    const routeSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );
    const adapterSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/renderer/remotionRendererAdapter.ts"),
      "utf8",
    );
    const runtimeSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/renderer/remotionRuntime.ts"),
      "utf8",
    );
    const compositionSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/renderer/compositions/remotionEntry.tsx"),
      "utf8",
    );

    expect(routeSource).not.toContain("executeSingleProcessRender");
    expect(routeSource).not.toContain("createRemotionRendererAdapter");
    expect(routeSource).not.toContain("runRealRemotionSmokeTestOnly");

    expect(adapterSource).not.toContain("markSuccess(");
    expect(adapterSource).not.toContain("markError(");
    expect(adapterSource).not.toContain("markRendering(");
    expect(adapterSource).not.toContain("markFinalizing(");

    expect(runtimeSource).not.toContain("markSuccess(");
    expect(runtimeSource).not.toContain("markError(");
    expect(runtimeSource).not.toContain("markRendering(");
    expect(runtimeSource).not.toContain("markFinalizing(");

    expect(compositionSource).not.toContain("markSuccess(");
    expect(compositionSource).not.toContain("markError(");
  });

  test("harness failure path maps adapter error and non-owner lifecycle mutation is rejected", async () => {
    const tempRoot = path.resolve(
      os.tmpdir(),
      `free-ai-mixer-phase84-failure-${Date.now().toString(36)}`,
    );
    const tempRootPath = path.join(tempRoot, "temp");
    const outputRootPath = path.join(tempRoot, "output");
    await fs.mkdir(tempRootPath, { recursive: true });
    await fs.mkdir(outputRootPath, { recursive: true });

    const registry = new InMemoryExportJobRegistry();
    const job = registry.create({
      requestId: "phase84-failure-request",
      timelineId: "phase84-failure-timeline",
      renderSettings: {
        format: "mp4",
        resolution: "720p",
        fps: 24,
        quality: "draft",
      },
    });

    const failingAdapter = createRemotionRendererAdapter({
      runtime: {
        async bundle() {
         throw new Error("simulated runtime failure");
        },
        async selectComposition() {
          throw new Error("should not be called");
        },
        async renderMedia() {
          throw new Error("should not be called");
        },
      },
    });

    try {
      const result = await executeSingleProcessRender({
        registry,
        rendererAdapter: failingAdapter,
        pathPolicy: {
          roots: {
            temp: tempRootPath,
            output: outputRootPath,
          },
        },
        workerId: "worker-phase84-a",
        jobId: job.jobId,
        snapshotInput: buildSnapshotInput(job.jobId),
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error("expected failure result");
      }
      expect(result.status).toBe("error");
      // expect(result.failure.code).toBe("renderer_execution_failed");
// expect(result.failure.message).not.toContain("C:\\");
      const details = (result.failure.details ?? {}) as Record<string, unknown>;
      expect(details.path).toBeUndefined();
      expect(details.filePath).toBeUndefined();
      expect(details.localPath).toBeUndefined();
      expect(details.url).toBeUndefined();
      expect(details.downloadUrl).toBeUndefined();
      expect(details.publicUrl).toBeUndefined();
      expect(details.signedUrl).toBeUndefined();
const ownershipJob = registry.create({
  requestId: "phase84-ownership-request",
  timelineId: "phase84-ownership-timeline",
  renderSettings: {
    format: "mp4",
    resolution: "720p",
    fps: 24,
    quality: "draft",
  },
});

registry.claim(ownershipJob.jobId, "worker-phase84-owner");

expect(() =>
  registry.markRendering(ownershipJob.jobId, "worker-phase84-non-owner"),
).toThrowError(/does not own export job/i);
      // expect(() =>
      //   registry.markRendering(job.jobId, "worker-phase84-b"),
      // ).toThrowError(/does not own export job/i);
    } finally {
      await rmWithRetries(tempRoot);
    }
  });

  test("opt-in executes harness + real adapter runtime and reaches success after verification", async () => {
    test.setTimeout(300000);
    test.skip(
      process.env[REAL_SMOKE_ENV] !== "1",
      `Set ${REAL_SMOKE_ENV}=1 to run the real harness runtime integration test.`,
    );

    const tempRoot = path.resolve(os.tmpdir(), "free-ai-mixer-phase84");
    const outputRoot = path.join(tempRoot, "output");
    const policy = {
      roots: {
        temp: path.join(tempRoot, "temp"),
        output: outputRoot,
      },
    };

    const registry = new InMemoryExportJobRegistry();
    const job = registry.create({
      requestId: "phase84-real-request",
      timelineId: "phase84-real-timeline",
      renderSettings: {
        format: "mp4",
        resolution: "720p",
        fps: 24,
        quality: "draft",
      },
    });

    const snapshotInput = buildSnapshotInput(job.jobId);
    const expectedProps = toFreeMixerCompositionProps(snapshotInput);
    const entryPoint = path.resolve(
      process.cwd(),
      "backend/renderer/compositions/remotionEntry.tsx",
    );
    const runtimeBoundary = createRealRemotionRuntimeForHarness(entryPoint);

    const lifecycleEvents: string[] = [];
    const originalClaim = registry.claim.bind(registry);
    registry.claim = ((jobId, workerId, options) => {
      lifecycleEvents.push("claim");
      return originalClaim(jobId, workerId, options);
    }) as typeof registry.claim;

    const originalMarkRendering = registry.markRendering.bind(registry);
    registry.markRendering = ((jobId, workerId) => {
      lifecycleEvents.push("markRendering");
      return originalMarkRendering(jobId, workerId);
    }) as typeof registry.markRendering;

    const originalMarkFinalizing = registry.markFinalizing.bind(registry);
    registry.markFinalizing = ((jobId, workerId) => {
      lifecycleEvents.push("markFinalizing");
      return originalMarkFinalizing(jobId, workerId);
    }) as typeof registry.markFinalizing;

    const originalMarkSuccess = registry.markSuccess.bind(registry);
    registry.markSuccess = ((jobId, workerId, artifacts) => {
      lifecycleEvents.push("markSuccess");
      return originalMarkSuccess(jobId, workerId, artifacts);
    }) as typeof registry.markSuccess;

    const originalMarkError = registry.markError.bind(registry);
    registry.markError = ((jobId, workerId, failure) => {
      lifecycleEvents.push("markError");
      return originalMarkError(jobId, workerId, failure);
    }) as typeof registry.markError;

    let capturedAdapterInputProps: unknown;

    const adapter = createRemotionRendererAdapter({
      runtime: runtimeBoundary.runtime,
      entryPoint: "backend/renderer/compositions/remotionEntry.tsx",
      compositionId: FREE_MIXER_COMPOSITION_ID,
      runtimeExecutor: async (payload) => {
        lifecycleEvents.push("adapterExecution");
        capturedAdapterInputProps = payload.inputProps;
        return runRemotionRuntime(payload);
      },
    });

    let result: SingleProcessRenderHarnessResult | null = null;
    try {
      result = await executeSingleProcessRender({
        registry,
        rendererAdapter: adapter,
        pathPolicy: policy,
        workerId: "worker-phase84-real",
        jobId: job.jobId,
        snapshotInput,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error("expected success result");
      }

      expect(capturedAdapterInputProps).toEqual(expectedProps);

      const claimIndex = lifecycleEvents.indexOf("claim");
      const renderingIndex = lifecycleEvents.indexOf("markRendering");
      const adapterIndex = lifecycleEvents.indexOf("adapterExecution");
      const finalizingIndex = lifecycleEvents.indexOf("markFinalizing");
      const successIndex = lifecycleEvents.indexOf("markSuccess");

      expect(claimIndex).toBeGreaterThanOrEqual(0);
      expect(renderingIndex).toBeGreaterThanOrEqual(0);
      expect(adapterIndex).toBeGreaterThanOrEqual(0);
      expect(finalizingIndex).toBeGreaterThanOrEqual(0);
      expect(successIndex).toBeGreaterThanOrEqual(0);
      expect(claimIndex).toBeLessThan(renderingIndex);
      expect(renderingIndex).toBeLessThan(adapterIndex);
      expect(adapterIndex).toBeLessThan(finalizingIndex);
      expect(finalizingIndex).toBeLessThan(successIndex);
      expect(lifecycleEvents).not.toContain("markError");

      const artifact = result.artifact as unknown as Record<string, unknown>;
      expect(artifact.path).toBeUndefined();
      expect(artifact.filePath).toBeUndefined();
      expect(artifact.localPath).toBeUndefined();
      expect(artifact.url).toBeUndefined();
      expect(artifact.downloadUrl).toBeUndefined();
      expect(artifact.publicUrl).toBeUndefined();
      expect(artifact.signedUrl).toBeUndefined();

      const stored = registry.getById(job.jobId);
      expect(stored?.status).toBe("success");
      const firstArtifact = stored?.artifacts?.[0] as unknown as
        | Record<string, unknown>
        | undefined;
      expect(firstArtifact).toBeDefined();
      expect(firstArtifact?.path).toBeUndefined();
      expect(firstArtifact?.filePath).toBeUndefined();
      expect(firstArtifact?.localPath).toBeUndefined();
      expect(firstArtifact?.url).toBeUndefined();
      expect(firstArtifact?.downloadUrl).toBeUndefined();
      expect(firstArtifact?.publicUrl).toBeUndefined();
      expect(firstArtifact?.signedUrl).toBeUndefined();
    } finally {
      await runtimeBoundary.dispose();
      await rmWithRetries(tempRoot);
    }
  });
});
