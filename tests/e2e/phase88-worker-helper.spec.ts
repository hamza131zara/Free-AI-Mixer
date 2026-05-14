import { expect, test } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { InMemoryExportJobRegistry } from "../../backend/registry/exportJobRegistry";
import { drainRenderWorkerOnce } from "../../backend/workers/renderWorker";
import type {
  RendererAdapterInput,
  RendererAdapterResult,
} from "../../backend/renderer/singleProcessRenderHarness";

const createTempRoot = async (): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), "phase88-worker-"));

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

test.describe("phase88 worker helper", () => {
  test("worker helper finds/submits eligible job to executeRenderJob", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();

    const rendererAdapter = async (
      input: RendererAdapterInput,
    ): Promise<RendererAdapterResult> => {
      await fs.mkdir(input.resolvedOutputPath.directoryPath, { recursive: true });
      await fs.writeFile(input.resolvedOutputPath.filePath, Buffer.from("phase88-video"));
      return { ok: true };
    };

    const job = registry.create({
      requestId: "phase88-eligible-test",
      timelineId: "phase88-timeline",
      renderSettings: {
        format: "mp4",
        resolution: "720p",
        fps: 24,
        quality: "draft",
      },
    });

    try {
      const result = await drainRenderWorkerOnce(registry, rendererAdapter, {
        roots: {
          temp: path.join(tempRoot, "temp"),
          output: path.join(tempRoot, "output"),
        },
      }, { workerId: "phase88-worker" });

      expect(result.workerId).toBe("phase88-worker");
      expect(result.acceptedCount).toBe(1);
      expect(result.skippedCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.attemptedJobIds).toContain(job.jobId);
      expect(result.errors).toHaveLength(0);

      const storedJob = registry.getById(job.jobId);
      expect(storedJob?.status).toBe("success");
    } finally {
      await cleanupTempRoot(tempRoot);
    }
  });

  test("worker helper skips terminal jobs such as success/error/expired", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();

    const rendererAdapter = async (
      input: RendererAdapterInput,
    ): Promise<RendererAdapterResult> => {
      await fs.mkdir(input.resolvedOutputPath.directoryPath, { recursive: true });
      await fs.writeFile(input.resolvedOutputPath.filePath, Buffer.from("phase88-video"));
      return { ok: true };
    };

    const successJob = registry.create({
      requestId: "phase88-success-job",
      timelineId: "phase88-timeline",
      renderSettings: {
        format: "mp4",
        resolution: "720p",
        fps: 24,
        quality: "draft",
      },
    });
    registry.transition(successJob.jobId, "rendering");
    registry.transition(successJob.jobId, "finalizing");
    registry.transition(successJob.jobId, "success", {
      artifacts: [{
        artifactId: "existing-artifact",
        jobId: successJob.jobId,
        kind: "render_output",
        format: "mp4",
        status: "available",
        createdAt: new Date().toISOString(),
      }],
    });

    const submittedJob = registry.create({
      requestId: "phase88-submitted-job",
      timelineId: "phase88-timeline",
      renderSettings: {
        format: "mp4",
        resolution: "720p",
        fps: 24,
        quality: "draft",
      },
    });

    try {
      const result = await drainRenderWorkerOnce(registry, rendererAdapter, {
        roots: {
          temp: path.join(tempRoot, "temp"),
          output: path.join(tempRoot, "output"),
        },
      }, { workerId: "phase88-worker" });

      expect(result.acceptedCount).toBe(1);
      expect(result.skippedCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.attemptedJobIds).toContain(submittedJob.jobId);
      expect(result.attemptedJobIds).not.toContain(successJob.jobId);
    } finally {
      await cleanupTempRoot(tempRoot);
    }
  });

  test("worker helper does not directly call lifecycle mutation methods", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/workers/renderWorker.ts"),
      "utf8",
    );

    expect(source).not.toContain("registry.claim(");
    expect(source).not.toContain("registry.markRendering(");
    expect(source).not.toContain("registry.markFinalizing(");
    expect(source).not.toContain("registry.markSuccess(");
    expect(source).not.toContain("registry.markError(");
    expect(source).toContain("executeRenderJob");
  });

  test("worker summary does not expose local path, filePath, path, url, artifactUrl, downloadUrl, or signedUrl", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/workers/renderWorker.ts"),
      "utf8",
    );

    expect(source).not.toContain("filePath:");
    expect(source).not.toContain("path:");
    expect(source).not.toContain("url:");
    expect(source).not.toContain("downloadUrl");
    expect(source).not.toContain("signedUrl");
    expect(source).not.toContain("artifactUrl");
  });

  test("duplicate execution is prevented or safely delegated to existing claim mechanism", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();

    let executionCount = 0;
    const rendererAdapter = async (
      input: RendererAdapterInput,
    ): Promise<RendererAdapterResult> => {
      executionCount += 1;
      await fs.mkdir(input.resolvedOutputPath.directoryPath, { recursive: true });
      await fs.writeFile(input.resolvedOutputPath.filePath, Buffer.from("phase88-video"));
      return { ok: true };
    };

    const job = registry.create({
      requestId: "phase88-dup-test",
      timelineId: "phase88-timeline",
      renderSettings: {
        format: "mp4",
        resolution: "720p",
        fps: 24,
        quality: "draft",
      },
    });

    try {
      const result1 = await drainRenderWorkerOnce(registry, rendererAdapter, {
        roots: {
          temp: path.join(tempRoot, "temp"),
          output: path.join(tempRoot, "output"),
        },
      }, { workerId: "phase88-worker-1" });

      expect(result1.acceptedCount).toBe(1);
      expect(executionCount).toBe(1);

      const result2 = await drainRenderWorkerOnce(registry, rendererAdapter, {
        roots: {
          temp: path.join(tempRoot, "temp"),
          output: path.join(tempRoot, "output"),
        },
      }, { workerId: "phase88-worker-2" });

      expect(result2.acceptedCount).toBe(0);
      expect(result2.attemptedJobIds).toHaveLength(0);
      expect(executionCount).toBe(1);

      const storedJob = registry.getById(job.jobId);
      expect(storedJob?.status).toBe("success");
    } finally {
      await cleanupTempRoot(tempRoot);
    }
  });
});