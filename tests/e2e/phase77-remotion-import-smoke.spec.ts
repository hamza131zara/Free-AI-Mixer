import { expect, test } from "@playwright/test";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createRemotionRendererAdapter } from "../../backend/renderer/remotionRendererAdapter";

test.describe("phase77 remotion import smoke", () => {
  test("dynamically imports remotion", async () => {
    const remotionModule = await import("remotion");
    expect(remotionModule).toBeTruthy();
    expect(typeof remotionModule).toBe("object");
  });

  test("dynamically imports @remotion/renderer", async () => {
    const rendererModule = await import("@remotion/renderer");
    expect(rendererModule).toBeTruthy();
    expect(typeof rendererModule).toBe("object");
  });

test("keeps adapter stub not-implemented after renderer package import", async () => {
  const rendererModule = await import("@remotion/renderer");
  expect(rendererModule).toBeTruthy();
  expect(typeof rendererModule).toBe("object");

  // Import smoke only: do not call renderMedia, bundle, selectComposition,
  // getCompositions, openBrowser, or any output-writing renderer API.
  const adapter = createRemotionRendererAdapter({ workerId: "worker-phase77" });  
    const result = await adapter({
      snapshot: {
        jobId: "job-phase77",
        timelineId: "timeline-phase77",
        renderSettings: {
          format: "mp4",
          resolution: "1080p",
          fps: 30,
          quality: "standard",
        },
        timelineSnapshot: {
          timelineId: "timeline-phase77",
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
          jobFolderKey: "job-phase77",
          artifactBaseName: "final",
          format: "mp4",
        },
      },
      resolvedOutputPath: {
        rootKey: "output",
        rootPath: "C:\\safe-output-root",
        jobSegment: "job-phase77",
        fileName: "final.mp4",
        directoryPath: "C:\\safe-output-root\\job-phase77",
        filePath: "C:\\safe-output-root\\job-phase77\\final.mp4",
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("adapter unexpectedly returned success");
    }

    const error = result.error as Record<string, unknown>;
    expect(error.message).toBe(
      "Remotion renderer adapter is not implemented in this phase.",
    );
    expect(error.code).toBe("renderer_execution_failed");
    expect(result.diagnostics).toMatchObject({
      code: "renderer_execution_failed",
      retryable: false,
    });

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
test("no route auto-execution wiring and no renderer runtime execution added", async () => {
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
});
