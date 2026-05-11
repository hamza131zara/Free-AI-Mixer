import { expect, test } from "@playwright/test";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  createRemotionRendererAdapter,
  type RemotionRendererRuntime,
} from "../../backend/renderer/remotionRendererAdapter";
import type { RendererAdapterInput } from "../../backend/renderer/singleProcessRenderHarness";
import { toFreeMixerCompositionProps } from "../../backend/renderer/compositions/compositionProps";

const createAdapterInput = (): RendererAdapterInput => ({
  snapshot: {
    jobId: "job-phase78",
    timelineId: "timeline-phase78",
    renderSettings: {
      format: "mp4",
      resolution: "1080p",
      fps: 30,
      quality: "standard",
    },
    timelineSnapshot: {
      timelineId: "timeline-phase78",
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
      jobFolderKey: "job-phase78",
      artifactBaseName: "final",
      format: "mp4",
    },
  },
  resolvedOutputPath: {
    rootKey: "output",
    rootPath: "C:\\safe-output-root",
    jobSegment: "job-phase78",
    fileName: "final.mp4",
    directoryPath: "C:\\safe-output-root\\job-phase78",
    filePath: "C:\\safe-output-root\\job-phase78\\final.mp4",
  },
});

test.describe("phase78 remotion adapter with mocked runtime", () => {
  test("returns not-implemented failure when runtime is not injected", async () => {
    const adapter = createRemotionRendererAdapter({ workerId: "worker-phase78" });
    const result = await adapter(createAdapterInput());
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure result");
    }
    expect((result.error as Record<string, unknown>).message).toBe(
      "Remotion renderer adapter is not implemented in this phase.",
    );
  });

  test("calls bundle -> selectComposition -> renderMedia in sequence with mocked runtime", async () => {
    const calls: string[] = [];
    const input = createAdapterInput();

    let selectedProps: unknown;
    let renderProps: unknown;
    let renderOutputLocation: string | undefined;

    const runtime: RemotionRendererRuntime = {
      async bundle() {
        calls.push("bundle");
        return { serveUrl: "mock://bundle" };
      },
      async selectComposition(payload) {
        calls.push("selectComposition");
        selectedProps = payload.inputProps;
        return { id: payload.compositionId };
      },
      async renderMedia(payload) {
        calls.push("renderMedia");
        renderProps = payload.inputProps;
        renderOutputLocation = payload.outputLocation;
        return { ok: true };
      },
    };

    const adapter = createRemotionRendererAdapter({
      runtime,
      workerId: "worker-phase78",
      entryPoint: "backend/renderer/mock-entry.ts",
      compositionId: "MockComposition",
    });

    const result = await adapter(input);
    expect(calls).toEqual(["bundle", "selectComposition", "renderMedia"]);
    const expectedProps = toFreeMixerCompositionProps(input.snapshot);
    expect(selectedProps).toEqual(expectedProps);
    expect(renderProps).toEqual(expectedProps);
    expect(renderOutputLocation).toBe(input.resolvedOutputPath.filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success result");
    }

    const diagnostics = result.diagnostics as Record<string, unknown>;
    expect(diagnostics.path).toBeUndefined();
    expect(diagnostics.filePath).toBeUndefined();
    expect(diagnostics.localPath).toBeUndefined();
    expect(diagnostics.url).toBeUndefined();
    expect(diagnostics.downloadUrl).toBeUndefined();
    expect(diagnostics.publicUrl).toBeUndefined();
    expect(diagnostics.signedUrl).toBeUndefined();
    expect(diagnostics.artifacts).toBeUndefined();
  });

  test("bundle failure returns safe failure without stack/path/url leakage", async () => {
    const runtime: RemotionRendererRuntime = {
      async bundle() {
        throw new Error("bundle failed at C:\\secret\\file.ts");
      },
      async selectComposition() {
        throw new Error("should not be called");
      },
      async renderMedia() {
        throw new Error("should not be called");
      },
    };

    const adapter = createRemotionRendererAdapter({ runtime });
    const result = await adapter(createAdapterInput());
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure result");
    }

    const diagnostics = (result.diagnostics ?? {}) as Record<string, unknown>;
    expect(diagnostics.path).toBeUndefined();
    expect(diagnostics.filePath).toBeUndefined();
    expect(diagnostics.localPath).toBeUndefined();
    expect(diagnostics.url).toBeUndefined();
    expect(diagnostics.downloadUrl).toBeUndefined();
    expect(diagnostics.publicUrl).toBeUndefined();
    expect(diagnostics.signedUrl).toBeUndefined();
    expect(diagnostics.artifacts).toBeUndefined();
  });

  test("selectComposition failure returns safe failure", async () => {
    const runtime: RemotionRendererRuntime = {
      async bundle() {
        return { serveUrl: "mock://bundle" };
      },
      async selectComposition() {
        throw new Error("select failed");
      },
      async renderMedia() {
        throw new Error("should not be called");
      },
    };

    const adapter = createRemotionRendererAdapter({ runtime });
    const result = await adapter(createAdapterInput());
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure result");
    }
    expect((result.error as Record<string, unknown>).code).toBe(
      "renderer_execution_failed",
    );
  });

  test("renderMedia failure returns safe failure", async () => {
    const runtime: RemotionRendererRuntime = {
      async bundle() {
        return { serveUrl: "mock://bundle" };
      },
      async selectComposition(payload) {
        return { id: payload.compositionId };
      },
      async renderMedia() {
        throw new Error("render failed");
      },
    };

    const adapter = createRemotionRendererAdapter({ runtime });
    const result = await adapter(createAdapterInput());
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure result");
    }
    expect((result.error as Record<string, unknown>).code).toBe(
      "renderer_execution_failed",
    );
  });

  // test("no route auto-execution wiring and no composition files added", async () => {
  //   const routeSource = await fs.readFile(
  //     path.resolve(process.cwd(), "backend/routes/exports.ts"),
  //     "utf8",
  //   );
  //   expect(routeSource.includes("executeSingleProcessRender")).toBe(false);
  //   expect(routeSource.includes("remotionRendererAdapter")).toBe(false);

  //   const entries = await fs.readdir(path.resolve(process.cwd(), "backend"), {
  //     recursive: true,
  //   });
  //   const hasCompositionFile = entries.some((entry) =>
  //     String(entry).toLowerCase().includes("composition"),
  //   );
  //   expect(hasCompositionFile).toBe(false);
  // });
  test("no route auto-execution wiring and no direct real Remotion imports", async () => {
  const routeSource = await fs.readFile(
    path.resolve(process.cwd(), "backend/routes/exports.ts"),
    "utf8",
  );

  expect(routeSource.includes("executeSingleProcessRender")).toBe(false);
  expect(routeSource.includes("remotionRendererAdapter")).toBe(false);

  const adapterSource = await fs.readFile(
    path.resolve(process.cwd(), "backend/renderer/remotionRendererAdapter.ts"),
    "utf8",
  );

  expect(adapterSource).not.toContain('from "remotion"');
  expect(adapterSource).not.toContain("from 'remotion'");
  expect(adapterSource).not.toContain('from "@remotion/renderer"');
  expect(adapterSource).not.toContain("from '@remotion/renderer'");
  expect(adapterSource).not.toContain('require("remotion")');
  expect(adapterSource).not.toContain("require('remotion')");
  expect(adapterSource).not.toContain('require("@remotion/renderer")');
  expect(adapterSource).not.toContain("require('@remotion/renderer')");
  expect(adapterSource).not.toContain("getCompositions(");
  expect(adapterSource).not.toContain("openBrowser(");
});
});
