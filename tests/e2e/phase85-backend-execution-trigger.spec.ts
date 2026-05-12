import { expect, test } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { InMemoryExportJobRegistry } from "../../backend/registry/exportJobRegistry";
import { executeRenderJob } from "../../backend/renderer/executeRenderJob";
import type {
  RendererAdapterInput,
  RendererAdapterResult,
} from "../../backend/renderer/singleProcessRenderHarness";
import type { RenderInputSnapshot } from "../../backend/contracts/renderInputSnapshot";

const createTempRoot = async (): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), "phase85-trigger-"));

const cleanupTempRoot = async (targetPath: string, retries = 6): Promise<void> => {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await fs.rm(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === retries - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
};

const createSnapshotInput = (jobId: string): RenderInputSnapshot => ({
  jobId,
  timelineId: "phase85-timeline",
  renderSettings: {
    format: "mp4",
    resolution: "720p",
    fps: 24,
    quality: "draft",
  },
  timelineSnapshot: {
    timelineId: "phase85-timeline",
    clips: [
      {
        clipId: "clip-1",
        sceneRefId: "scene-1",
        startMs: 0,
        durationMs: 150,
        order: 0,
      },
    ],
  },
  sceneRefs: [{ sceneId: "scene-1", role: "primary" }],
  mediaRefs: [],
  outputTarget: {
    jobFolderKey: jobId,
    artifactBaseName: "phase85_output",
    format: "mp4",
  },
});

test.describe("phase85 backend execution trigger", () => {
  test("trigger source delegates to harness and stays lifecycle-neutral", async () => {
    const triggerSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/renderer/executeRenderJob.ts"),
      "utf8",
    );

    expect(triggerSource).toContain("executeSingleProcessRender");
    expect(triggerSource).not.toContain(".claim(");
    expect(triggerSource).not.toContain(".markRendering(");
    expect(triggerSource).not.toContain(".markFinalizing(");
    expect(triggerSource).not.toContain(".markSuccess(");
    expect(triggerSource).not.toContain(".markError(");
    expect(triggerSource).not.toContain("downloadUrl");
    expect(triggerSource).not.toContain("signedUrl");
    expect(triggerSource).not.toContain("publicUrl");
    expect(triggerSource).not.toContain("createObjectURL");
    expect(triggerSource).not.toContain("router.");
    expect(triggerSource).not.toContain("fetch(");
    expect(triggerSource).not.toContain("setInterval(");
  });

  test("routes remain non-executing and metadata-only", async () => {
    const routeSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );

    expect(routeSource).not.toContain("executeRenderJob");
    expect(routeSource).not.toContain("executeSingleProcessRender");
    expect(routeSource).not.toContain("createRemotionRendererAdapter");
    expect(routeSource).not.toContain("runRealRemotionSmokeTestOnly");
    expect(routeSource).toContain('response.status(202).json({');
    expect(routeSource).toContain('kind: "accepted_job"');
  });

  test("internal trigger success path uses harness verification and reaches success", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();
    const job = registry.create({
      requestId: "phase85-success-request",
      timelineId: "phase85-timeline",
      renderSettings: {
        format: "mp4",
        resolution: "720p",
        fps: 24,
        quality: "draft",
      },
    });

    const rendererAdapter = async (
      input: RendererAdapterInput,
    ): Promise<RendererAdapterResult> => {
      await fs.mkdir(input.resolvedOutputPath.directoryPath, { recursive: true });
      await fs.writeFile(input.resolvedOutputPath.filePath, Buffer.from("phase85-video"));
      return { ok: true };
    };

    try {
      const result = await executeRenderJob({
        registry,
        rendererAdapter,
        pathPolicy: {
          roots: {
            temp: path.join(tempRoot, "temp"),
            output: path.join(tempRoot, "output"),
          },
        },
        workerId: "worker-phase85-success",
        jobId: job.jobId,
        snapshotInput: createSnapshotInput(job.jobId),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error("expected success result");
      }

      const storedJob = registry.getById(job.jobId);
      expect(storedJob?.status).toBe("success");

      const artifact = result.artifact as unknown as Record<string, unknown>;
      expect(artifact.path).toBeUndefined();
      expect(artifact.filePath).toBeUndefined();
      expect(artifact.localPath).toBeUndefined();
      expect(artifact.url).toBeUndefined();
      expect(artifact.downloadUrl).toBeUndefined();
      expect(artifact.publicUrl).toBeUndefined();
      expect(artifact.signedUrl).toBeUndefined();
    } finally {
      await cleanupTempRoot(tempRoot);
    }
  });

  test("internal trigger failure path maps adapter failure and remains sanitized", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();
    const job = registry.create({
      requestId: "phase85-failure-request",
      timelineId: "phase85-timeline",
      renderSettings: {
        format: "mp4",
        resolution: "720p",
        fps: 24,
        quality: "draft",
      },
    });

    const rendererAdapter = async (): Promise<RendererAdapterResult> => ({
      ok: false,
      error: new Error("simulated renderer failure"),
      transient: false,
    });

    try {
      const result = await executeRenderJob({
        registry,
        rendererAdapter,
        pathPolicy: {
          roots: {
            temp: path.join(tempRoot, "temp"),
            output: path.join(tempRoot, "output"),
          },
        },
        workerId: "worker-phase85-failure",
        jobId: job.jobId,
        snapshotInput: createSnapshotInput(job.jobId),
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error("expected failure result");
      }

      expect(result.status).toBe("error");
      const details = (result.failure.details ?? {}) as Record<string, unknown>;
      expect(details.path).toBeUndefined();
      expect(details.filePath).toBeUndefined();
      expect(details.localPath).toBeUndefined();
      expect(details.url).toBeUndefined();
      expect(details.downloadUrl).toBeUndefined();
      expect(details.publicUrl).toBeUndefined();
      expect(details.signedUrl).toBeUndefined();
      expect(registry.getById(job.jobId)?.status).toBe("error");
    } finally {
      await cleanupTempRoot(tempRoot);
    }
  });
});
