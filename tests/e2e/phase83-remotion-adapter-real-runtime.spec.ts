import { expect, test } from "@playwright/test";
import path from "node:path";
import { promises as fs } from "node:fs";
import type { RendererAdapterInput } from "../../backend/renderer/singleProcessRenderHarness";
import {
  createRemotionRendererAdapter,
  type RemotionRendererRuntime,
} from "../../backend/renderer/remotionRendererAdapter";
import {
  FREE_MIXER_COMPOSITION_ID,
  toFreeMixerCompositionProps,
} from "../../backend/renderer/compositions/compositionProps";

const createAdapterInput = (): RendererAdapterInput => ({
  snapshot: {
    jobId: "job-phase83",
    timelineId: "timeline-phase83",
    renderSettings: {
      format: "mp4",
      resolution: "1080p",
      fps: 30,
      quality: "standard",
    },
    timelineSnapshot: {
      timelineId: "timeline-phase83",
      clips: [
        {
          clipId: "clip-1",
          sceneRefId: "scene-1",
          startMs: 0,
          durationMs: 1000,
          order: 0,
        },
      ],
    },
    sceneRefs: [{ sceneId: "scene-1" }],
    mediaRefs: [],
    outputTarget: {
      jobFolderKey: "job-phase83",
      artifactBaseName: "final",
      format: "mp4",
    },
  },
  resolvedOutputPath: {
    rootKey: "output",
    rootPath: "C:\\safe-output-root",
    jobSegment: "job-phase83",
    fileName: "final.mp4",
    directoryPath: "C:\\safe-output-root\\job-phase83",
    filePath: "C:\\safe-output-root\\job-phase83\\final.mp4",
  },
});

test.describe("phase83 adapter runtime integration boundary", () => {
  test("adapter default entryPoint and compositionId align to backend composition boundary", async () => {
    const input = createAdapterInput();
    let capturedEntryPoint = "";
    let capturedCompositionId = "";

    const runtime: RemotionRendererRuntime = {
      async bundle() {
        return { serveUrl: "mock://bundle" };
      },
      async selectComposition(payload) {
        return { id: payload.compositionId };
      },
      async renderMedia() {
        return { ok: true };
      },
    };

    const adapter = createRemotionRendererAdapter({
      runtime,
      runtimeExecutor: async (payload) => {
        capturedEntryPoint = payload.entryPoint;
        capturedCompositionId = payload.compositionId;
        return { ok: true };
      },
    });

    const result = await adapter(input);
    expect(result.ok).toBe(true);
    expect(capturedEntryPoint).toBe("backend/renderer/compositions/remotionEntry.tsx");
    expect(capturedCompositionId).toBe(FREE_MIXER_COMPOSITION_ID);
  });

  test("adapter converts snapshot to composition props before runtime call", async () => {
    const input = createAdapterInput();
    let capturedInputProps: unknown;

    const runtime: RemotionRendererRuntime = {
      async bundle() {
        return { serveUrl: "mock://bundle" };
      },
      async selectComposition(payload) {
        return { id: payload.compositionId };
      },
      async renderMedia() {
        return { ok: true };
      },
    };

    const adapter = createRemotionRendererAdapter({
      runtime,
      runtimeExecutor: async (payload) => {
        capturedInputProps = payload.inputProps;
        return { ok: true };
      },
    });

    await adapter(input);

    expect(capturedInputProps).toEqual(toFreeMixerCompositionProps(input.snapshot));
    expect(capturedInputProps).not.toEqual(input.snapshot);
  });

  test("adapter remains lifecycle-neutral and artifact-neutral", async () => {
    const adapterSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/renderer/remotionRendererAdapter.ts"),
      "utf8",
    );

    expect(adapterSource).not.toContain("markSuccess(");
    expect(adapterSource).not.toContain("markError(");
    expect(adapterSource).not.toContain("markRendering(");
    expect(adapterSource).not.toContain("markFinalizing(");
    expect(adapterSource).not.toContain("verifyRenderedArtifact(");
    expect(adapterSource).not.toContain("buildVerifiedArtifactMetadata(");
    expect(adapterSource).not.toContain("downloadUrl");
    expect(adapterSource).not.toContain("signedUrl");
    expect(adapterSource).not.toContain("publicUrl");
  });

  test("adapter keeps delegation boundary and does not call Remotion runtime APIs directly", async () => {
    const adapterSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/renderer/remotionRendererAdapter.ts"),
      "utf8",
    );

    expect(adapterSource).not.toContain("bundle(");
    expect(adapterSource).not.toContain("getCompositions(");
    expect(adapterSource).not.toContain("selectComposition(");
    expect(adapterSource).not.toContain("renderMedia(");
    expect(adapterSource).not.toContain("openBrowser(");
    expect(adapterSource).not.toContain("ensureBrowser(");
  });

  test("routes remain non auto-executing and adapter stays backend-only", async () => {
    const routeSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );
    const adapterSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/renderer/remotionRendererAdapter.ts"),
      "utf8",
    );

    expect(routeSource).not.toContain("executeSingleProcessRender");
    expect(routeSource).not.toContain("createRemotionRendererAdapter");
    expect(routeSource).not.toContain("runRealRemotionSmokeTestOnly");

    expect(adapterSource).not.toContain("src/store");
    expect(adapterSource).not.toContain("src/services");
    expect(adapterSource).not.toContain("src/agents");
    expect(adapterSource).not.toContain("src/components");
  });
});
