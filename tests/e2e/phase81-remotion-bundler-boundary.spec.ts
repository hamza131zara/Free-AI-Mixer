import { expect, test } from "@playwright/test";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createRemotionRendererAdapter } from "../../backend/renderer/remotionRendererAdapter";
import {
  createDefaultRemotionRuntime,
  createDefaultRemotionBundlerBoundary,
  runRemotionRuntime,
  type RemotionRendererRuntime,
} from "../../backend/renderer/remotionRuntime";
import type { RendererAdapterInput } from "../../backend/renderer/singleProcessRenderHarness";

const createAdapterInput = (): RendererAdapterInput => ({
  snapshot: {
    jobId: "job-phase81",
    timelineId: "timeline-phase81",
    renderSettings: {
      format: "mp4",
      resolution: "1080p",
      fps: 30,
      quality: "standard",
    },
    timelineSnapshot: {
      timelineId: "timeline-phase81",
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
      jobFolderKey: "job-phase81",
      artifactBaseName: "final",
      format: "mp4",
    },
  },
  resolvedOutputPath: {
    rootKey: "output",
    rootPath: "C:\\safe-output-root",
    jobSegment: "job-phase81",
    fileName: "final.mp4",
    directoryPath: "C:\\safe-output-root\\job-phase81",
    filePath: "C:\\safe-output-root\\job-phase81\\final.mp4",
  },
});

test.describe("phase81 remotion bundler boundary prep", () => {
  test("bundler dependency is declared for runtime boundary prep", async () => {
    const packageSource = await fs.readFile(
      path.resolve(process.cwd(), "package.json"),
      "utf8",
    );
    const parsed = JSON.parse(packageSource) as {
      dependencies?: Record<string, string>;
    };
    expect(parsed.dependencies?.["@remotion/bundler"]).toBeTruthy();
  });

  test("runtime helper remains backend-only and avoids frontend imports", async () => {
    const runtimeSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/renderer/remotionRuntime.ts"),
      "utf8",
    );
    expect(runtimeSource).not.toContain("from \"../../src/");
    expect(runtimeSource).not.toContain("from '../../src/");
    expect(runtimeSource).not.toContain("src/store");
    expect(runtimeSource).not.toContain("src/services");
    expect(runtimeSource).not.toContain("src/agents");
    expect(runtimeSource).not.toContain("src/components");
  });

  test("runtime helper uses module-typed boundaries without unsafe casts", async () => {
    const runtimeSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/renderer/remotionRuntime.ts"),
      "utf8",
    );
    expect(runtimeSource).toContain("typeof import(\"@remotion/renderer\")");
    expect(runtimeSource).toContain("typeof import(\"@remotion/bundler\")");
    expect(runtimeSource).not.toContain("as any");
    expect(runtimeSource).not.toContain("as unknown as");
    expect(runtimeSource).not.toContain("@ts-ignore");
  });

  test("default runtime remains truthful and non-executing", async () => {
    const runtime = await createDefaultRemotionRuntime();

    await expect(
      runtime.bundle({ entryPoint: "backend/renderer/remotion-entry.ts" }),
    ).rejects.toThrow(/not implemented/i);
    await expect(
      runtime.selectComposition({
        serveUrl: "mock://bundle",
        compositionId: "FreeAiMixerComposition",
        inputProps: {},
      }),
    ).rejects.toThrow(/not implemented/i);
    await expect(
      runtime.renderMedia({
        serveUrl: "mock://bundle",
        composition: { id: "mock-comp" },
        codec: "h264",
        outputLocation: "C:\\safe-output-root\\job\\final.mp4",
        inputProps: {},
      }),
    ).rejects.toThrow(/not implemented/i);
  });

  test("injected runtime flow still works and stays side-effect-free for lifecycle", async () => {
    const calls: string[] = [];
    const runtime: RemotionRendererRuntime = {
      async bundle() {
        calls.push("bundle");
        return { serveUrl: "mock://bundle" };
      },
      async selectComposition(payload) {
        calls.push("selectComposition");
        return { id: payload.compositionId };
      },
      async renderMedia() {
        calls.push("renderMedia");
        return { ok: true };
      },
    };

    const adapter = createRemotionRendererAdapter({ runtime });
    const result = await adapter(createAdapterInput());
    expect(result.ok).toBe(true);
    expect(calls).toEqual(["bundle", "selectComposition", "renderMedia"]);
  });

  test("adapter/runtime failure stays sanitized", async () => {
    const runtime: RemotionRendererRuntime = {
      async bundle() {
        throw new Error(
          "bundle failed at C:\\secret\\entry.ts with token=abc and https://danger.local",
        );
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
      throw new Error("expected failure");
    }

    const diagnostics = (result.diagnostics ?? {}) as Record<string, unknown>;
    expect(diagnostics.path).toBeUndefined();
    expect(diagnostics.localPath).toBeUndefined();
    expect(diagnostics.url).toBeUndefined();
    expect(diagnostics.downloadUrl).toBeUndefined();
    expect(diagnostics.signedUrl).toBeUndefined();
    expect(diagnostics.stack).toBeUndefined();
    expect(diagnostics.token).toBeUndefined();
    expect(diagnostics.env).toBeUndefined();
  });

  test("routes remain non auto-executing and no hosting/download behavior is added", async () => {
    const routeSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );
    expect(routeSource.includes("executeSingleProcessRender")).toBe(false);
    expect(routeSource.includes("createRemotionRendererAdapter")).toBe(false);

    const runtimeSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/renderer/remotionRuntime.ts"),
      "utf8",
    );
    expect(runtimeSource).not.toContain("downloadUrl");
    expect(runtimeSource).not.toContain("signedUrl");
    expect(runtimeSource).not.toContain("artifactHosting");
  });

  test("bundler boundary can be imported without executing bundling", async () => {
    const bundler = await createDefaultRemotionBundlerBoundary();
    expect(bundler).toBeTruthy();
    expect(typeof bundler).toBe("object");
    expect(typeof runRemotionRuntime).toBe("function");
  });
});
