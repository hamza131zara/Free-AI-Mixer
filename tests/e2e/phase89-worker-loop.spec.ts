import { expect, test } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { InMemoryExportJobRegistry } from "../../backend/registry/exportJobRegistry";
import { drainRenderWorkerOnce, createRenderWorkerLoop } from "../../backend/workers/renderWorker";
import type {
  RendererAdapterInput,
  RendererAdapterResult,
} from "../../backend/renderer/singleProcessRenderHarness";

const createTempRoot = async (): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), "phase89-loop-"));

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

test.describe("phase89 worker loop", () => {
  test("loop does not start when FREE_AI_MIXER_ENABLE_WORKER_LOOP is missing", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();

    const rendererAdapter = async (): Promise<RendererAdapterResult> => ({ ok: true });

    const controller = createRenderWorkerLoop(registry, rendererAdapter, {
      roots: {
        temp: path.join(tempRoot, "temp"),
        output: path.join(tempRoot, "output"),
      },
    });

    controller.start();
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      expect(controller.isRunning()).toBe(false);
      expect(controller.getStatus().enabledByEnv).toBe(false);
    } finally {
      controller.stop();
      await cleanupTempRoot(tempRoot);
    }
  });

  test("loop starts when FREE_AI_MIXER_ENABLE_WORKER_LOOP=1", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();

    const rendererAdapter = async (): Promise<RendererAdapterResult> => ({ ok: true });

    const originalEnv = process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
    process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = "1";

    const controller = createRenderWorkerLoop(registry, rendererAdapter, {
      roots: {
        temp: path.join(tempRoot, "temp"),
        output: path.join(tempRoot, "output"),
      },
    });

    controller.start();
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      expect(controller.isRunning()).toBe(true);
      expect(controller.getStatus().enabledByEnv).toBe(true);
    } finally {
      controller.stop();
      process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = originalEnv ?? "";
      await cleanupTempRoot(tempRoot);
    }
  });

  test("loop stop() clears the interval and isRunning() becomes false", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();

    const rendererAdapter = async (): Promise<RendererAdapterResult> => ({ ok: true });

    const originalEnv = process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
    process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = "1";

    const controller = createRenderWorkerLoop(registry, rendererAdapter, {
      roots: {
        temp: path.join(tempRoot, "temp"),
        output: path.join(tempRoot, "output"),
      },
    });

    controller.start();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(controller.isRunning()).toBe(true);

    controller.stop();
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      expect(controller.isRunning()).toBe(false);
    } finally {
      process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = originalEnv ?? "";
      await cleanupTempRoot(tempRoot);
    }
  });

  test("calling start() twice does not create duplicate intervals", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();

    let tickCount = 0;
    const rendererAdapter = async (): Promise<RendererAdapterResult> => {
      tickCount += 1;
      return { ok: true };
    };

    const originalEnv = process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
    process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = "1";

    const controller = createRenderWorkerLoop(registry, rendererAdapter, {
      roots: {
        temp: path.join(tempRoot, "temp"),
        output: path.join(tempRoot, "output"),
      },
      pollIntervalMs: 100,
    });

    controller.start();
    controller.start();
    await new Promise((resolve) => setTimeout(resolve, 350));

    try {
      expect(tickCount).toBeLessThanOrEqual(4);
    } finally {
      controller.stop();
      process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = originalEnv ?? "";
      await cleanupTempRoot(tempRoot);
    }
  });

  test("loop calls drainRenderWorkerOnce and processes submitted jobs", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();

    const rendererAdapter = async (
      input: RendererAdapterInput,
    ): Promise<RendererAdapterResult> => {
      await fs.mkdir(input.resolvedOutputPath.directoryPath, { recursive: true });
      await fs.writeFile(input.resolvedOutputPath.filePath, Buffer.from("phase89-video"));
      return { ok: true };
    };

    const job = registry.create({
      requestId: "phase89-process-test",
      timelineId: "phase89-timeline",
      renderSettings: {
        format: "mp4",
        resolution: "720p",
        fps: 24,
        quality: "draft",
      },
    });

    const originalEnv = process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
    process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = "1";

    const controller = createRenderWorkerLoop(registry, rendererAdapter, {
      roots: {
        temp: path.join(tempRoot, "temp"),
        output: path.join(tempRoot, "output"),
      },
      pollIntervalMs: 100,
    });

    controller.start();
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      const storedJob = registry.getById(job.jobId);
      expect(storedJob?.status).toBe("success");
    } finally {
      controller.stop();
      process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = originalEnv ?? "";
      await cleanupTempRoot(tempRoot);
    }
  });

  test("loop contains drain errors and remains controllable", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();

    const failingRendererAdapter = async (): Promise<RendererAdapterResult> => {
      throw new Error("Simulated renderer failure");
    };

    const job = registry.create({
      requestId: "phase89-error-test",
      timelineId: "phase89-timeline",
      renderSettings: {
        format: "mp4",
        resolution: "720p",
        fps: 24,
        quality: "draft",
      },
    });

    const originalEnv = process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
    process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = "1";

    const controller = createRenderWorkerLoop(registry, failingRendererAdapter, {
      roots: {
        temp: path.join(tempRoot, "temp"),
        output: path.join(tempRoot, "output"),
      },
      pollIntervalMs: 100,
    });

    controller.start();
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      expect(controller.isRunning()).toBe(true);
      const storedJob = registry.getById(job.jobId);
      expect(storedJob?.status).toBe("error");
    } finally {
      controller.stop();
      process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = originalEnv ?? "";
      await cleanupTempRoot(tempRoot);
    }
  });

  test("loop prevents overlapping drain calls", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();

    let activeDrains = 0;
    let maxConcurrent = 0;
    const slowRendererAdapter = async (): Promise<RendererAdapterResult> => {
      activeDrains += 1;
      maxConcurrent = Math.max(maxConcurrent, activeDrains);
      await new Promise((resolve) => setTimeout(resolve, 150));
      activeDrains -= 1;
      return { ok: true };
    };

    registry.create({
      requestId: "phase89-overlap-test-1",
      timelineId: "phase89-timeline",
      renderSettings: {
        format: "mp4",
        resolution: "720p",
        fps: 24,
        quality: "draft",
      },
    });

    registry.create({
      requestId: "phase89-overlap-test-2",
      timelineId: "phase89-timeline",
      renderSettings: {
        format: "mp4",
        resolution: "720p",
        fps: 24,
        quality: "draft",
      },
    });

    const originalEnv = process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
    process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = "1";

    const controller = createRenderWorkerLoop(registry, slowRendererAdapter, {
      roots: {
        temp: path.join(tempRoot, "temp"),
        output: path.join(tempRoot, "output"),
      },
      pollIntervalMs: 50,
    });

    controller.start();
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      expect(maxConcurrent).toBeLessThanOrEqual(1);
    } finally {
      controller.stop();
      process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = originalEnv ?? "";
      await cleanupTempRoot(tempRoot);
    }
  });

  test("source proves createRenderWorkerLoop does not directly call executeSingleProcessRender or registry mutation methods", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/workers/renderWorker.ts"),
      "utf8",
    );

    expect(source).toContain("createRenderWorkerLoop");
    expect(source).not.toContain("executeSingleProcessRender");
    expect(source).not.toContain("registry.claim(");
    expect(source).not.toContain("registry.markRendering(");
    expect(source).not.toContain("registry.markFinalizing(");
    expect(source).not.toContain("registry.markSuccess(");
    expect(source).not.toContain("registry.markError(");
    expect(source).toContain("drainRenderWorkerOnce");
  });

  test("loop status/summary does not expose local path, filePath, path, url, artifactUrl, downloadUrl, or signedUrl", async () => {
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
});