import { expect, test } from "@playwright/test";
import path from "node:path";
import { promises as fs } from "node:fs";
import type { RendererAdapterInput } from "../../backend/renderer/singleProcessRenderHarness";
import {
  createRemotionRendererAdapter,
  remotionRendererAdapterNotImplementedCode,
} from "../../backend/renderer/remotionRendererAdapter";

const createAdapterInput = (): RendererAdapterInput => ({
  snapshot: {
    jobId: "job-phase75",
    timelineId: "timeline-phase75",
    renderSettings: {
      format: "mp4",
      resolution: "1080p",
      fps: 30,
      quality: "standard",
    },
    timelineSnapshot: {
      timelineId: "timeline-phase75",
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
      jobFolderKey: "job-phase75",
      artifactBaseName: "final",
      format: "mp4",
    },
  },
  resolvedOutputPath: {
    rootKey: "output",
    rootPath: "C:\\safe-output-root",
    jobSegment: "job-phase75",
    fileName: "final.mp4",
    directoryPath: "C:\\safe-output-root\\job-phase75",
    filePath: "C:\\safe-output-root\\job-phase75\\final.mp4",
  },
});

test.describe("phase75 remotion adapter contract stub", () => {
  test("adapter module imports without Remotion dependency installed", async () => {
    const module = await import("../../backend/renderer/remotionRendererAdapter");
    expect(typeof module.createRemotionRendererAdapter).toBe("function");
  });

  test("adapter factory returns a RendererAdapter-compatible function", () => {
    const adapter = createRemotionRendererAdapter({ workerId: "worker-phase75" });
    expect(typeof adapter).toBe("function");
  });

  test("stub adapter returns explicit not-implemented non-success result", async () => {
    const adapter = createRemotionRendererAdapter();
    const result = await adapter(createAdapterInput());

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected non-success result");
    }

    const error = result.error as Record<string, unknown>;
    expect(error.code).toBe(remotionRendererAdapterNotImplementedCode);
    expect(error.message).toBe(
      "Remotion renderer adapter is not implemented in this phase.",
    );
    expect(result.transient).toBe(false);
  });

  test("stub adapter never returns ok true", async () => {
    const adapter = createRemotionRendererAdapter();
    const result = await adapter(createAdapterInput());
    expect(result.ok).toBe(false);
  });

  test("stub diagnostics do not expose paths, urls, download fields, or artifact metadata", async () => {
    const adapter = createRemotionRendererAdapter({ workerId: "worker-phase75" });
    const result = await adapter(createAdapterInput());
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected non-success result");
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

  test("stub does not mutate lifecycle or call registry methods", async () => {
    let markSuccessCalled = false;
    let markErrorCalled = false;
    const input = createAdapterInput() as unknown as Record<string, unknown>;
    input.registry = {
      markSuccess: () => {
        markSuccessCalled = true;
      },
      markError: () => {
        markErrorCalled = true;
      },
    };

    const adapter = createRemotionRendererAdapter();
    const result = await adapter(input as unknown as RendererAdapterInput);
    expect(result.ok).toBe(false);
    expect(markSuccessCalled).toBe(false);
    expect(markErrorCalled).toBe(false);
  });
  test("adapter stub does not import Remotion runtime directly", async () => {
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
});

  // test("package.json does not add remotion dependencies in this phase", async () => {
  //   const packageJson = await fs.readFile(
  //     path.resolve(process.cwd(), "package.json"),
  //     "utf8",
  //   );
  //   const parsed = JSON.parse(packageJson) as {
  //     dependencies?: Record<string, string>;
  //     devDependencies?: Record<string, string>;
  //   };
  //   expect(parsed.dependencies?.remotion).toBeUndefined();
  //   expect(parsed.dependencies?.["@remotion/renderer"]).toBeUndefined();
  //   expect(parsed.devDependencies?.remotion).toBeUndefined();
  //   expect(parsed.devDependencies?.["@remotion/renderer"]).toBeUndefined();
  // });

  test("no route auto-execution was added", async () => {
    const routeSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );
    expect(routeSource.includes("executeSingleProcessRender")).toBe(false);
    expect(routeSource.includes("remotionRendererAdapter")).toBe(false);
  });
});
