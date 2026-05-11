import { expect, test } from "@playwright/test";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  createRemotionRendererAdapter,
  type RemotionRendererRuntime,
} from "../../backend/renderer/remotionRendererAdapter";
import { runRemotionRuntime } from "../../backend/renderer/remotionRuntime";
import type { RendererAdapterInput } from "../../backend/renderer/singleProcessRenderHarness";

const createAdapterInput = (): RendererAdapterInput => ({
  snapshot: {
    jobId: "job-phase80",
    timelineId: "timeline-phase80",
    renderSettings: {
      format: "mp4",
      resolution: "1080p",
      fps: 30,
      quality: "standard",
    },
    timelineSnapshot: {
      timelineId: "timeline-phase80",
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
      jobFolderKey: "job-phase80",
      artifactBaseName: "final",
      format: "mp4",
    },
  },
  resolvedOutputPath: {
    rootKey: "output",
    rootPath: "C:\\safe-output-root",
    jobSegment: "job-phase80",
    fileName: "final.mp4",
    directoryPath: "C:\\safe-output-root\\job-phase80",
    filePath: "C:\\safe-output-root\\job-phase80\\final.mp4",
  },
});

test.describe("phase80 remotion runtime boundary", () => {
  test("runtime helper exists as the dedicated runtime boundary", async () => {
    expect(typeof runRemotionRuntime).toBe("function");
  });

  test("adapter delegates runtime execution via runtime helper boundary", async () => {
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

    const runtimeExecutor: typeof runRemotionRuntime = async (payload) => {
      calls.push("runtimeExecutor");
      return runRemotionRuntime(payload);
    };

    const adapter = createRemotionRendererAdapter({ runtime, runtimeExecutor });
    const result = await adapter(createAdapterInput());
    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      "runtimeExecutor",
      "bundle",
      "selectComposition",
      "renderMedia",
    ]);
  });

  test("runtime helper failure returns sanitized adapter failure", async () => {
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

    const runtimeExecutor: typeof runRemotionRuntime = async () => {
      throw new Error(
        "failed at C:\\secret\\video.mp4 with token=abc and https://bad.local/file",
      );
    };

    const adapter = createRemotionRendererAdapter({ runtime, runtimeExecutor });
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
    expect(diagnostics.signedUrl).toBeUndefined();
    expect(diagnostics.stack).toBeUndefined();
    expect(diagnostics.env).toBeUndefined();
    expect(diagnostics.token).toBeUndefined();
    expect(diagnostics.logs).toBeUndefined();
  });

  test("runtime helper stays backend-only with no frontend imports", async () => {
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

  test("routes remain non auto-executing and no URL hosting behavior added", async () => {
    const routeSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );
    expect(routeSource.includes("executeSingleProcessRender")).toBe(false);
    expect(routeSource.includes("createRemotionRendererAdapter")).toBe(false);

    const adapterSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/renderer/remotionRendererAdapter.ts"),
      "utf8",
    );
    expect(adapterSource).not.toContain("downloadUrl");
    expect(adapterSource).not.toContain("signedUrl");
    expect(adapterSource).not.toContain("artifactHosting");
  });
});
