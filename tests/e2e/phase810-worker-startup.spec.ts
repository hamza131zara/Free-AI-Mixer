import { expect, test } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { InMemoryExportJobRegistry } from "../../backend/registry/exportJobRegistry";
import { createRenderWorkerStartup } from "../../backend/workers/renderWorkerStartup";
import type {
  RendererAdapterInput,
  RendererAdapterResult,
} from "../../backend/renderer/singleProcessRenderHarness";

const createTempRoot = async (): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), "phase810-startup-"));

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

test.describe("phase810 worker startup", () => {
  test("startup factory creates a controller with start/stop/isRunning/getStatus", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();

    const rendererAdapter = async (): Promise<RendererAdapterResult> => ({ ok: true });

    const controller = createRenderWorkerStartup(registry, rendererAdapter, {
      roots: {
        temp: path.join(tempRoot, "temp"),
        output: path.join(tempRoot, "output"),
      },
    });

    try {
      expect(typeof controller.start).toBe("function");
      expect(typeof controller.stop).toBe("function");
      expect(typeof controller.isRunning).toBe("function");
      expect(typeof controller.getStatus).toBe("function");
      expect(controller.getStatus().workerId).toBeDefined();
    } finally {
      controller.stop();
      await cleanupTempRoot(tempRoot);
    }
  });

  test("startup factory does not auto-start on creation", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();

    const rendererAdapter = async (): Promise<RendererAdapterResult> => ({ ok: true });

    const originalEnv = process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP;
    process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP = "1";
    const originalLoopEnv = process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
    process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = "1";

    const controller = createRenderWorkerStartup(registry, rendererAdapter, {
      roots: {
        temp: path.join(tempRoot, "temp"),
        output: path.join(tempRoot, "output"),
      },
    });

    try {
      expect(controller.isRunning()).toBe(false);
    } finally {
      controller.stop();
      process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP = originalEnv ?? "";
      process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = originalLoopEnv ?? "";
      await cleanupTempRoot(tempRoot);
    }
  });

  test("start() does not start worker when FREE_AI_MIXER_ENABLE_WORKER_STARTUP is missing", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();

    const rendererAdapter = async (): Promise<RendererAdapterResult> => ({ ok: true });

    const originalEnv = process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP;
    delete process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP;
    const originalLoopEnv = process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
    process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = "1";

    const controller = createRenderWorkerStartup(registry, rendererAdapter, {
      roots: {
        temp: path.join(tempRoot, "temp"),
        output: path.join(tempRoot, "output"),
      },
    });

    controller.start();
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      expect(controller.isRunning()).toBe(false);
      expect(controller.getStatus().startupEnabled).toBe(false);
    } finally {
      controller.stop();
      if (originalEnv !== undefined) {
        process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP = originalEnv;
      }
      process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = originalLoopEnv ?? "";
      await cleanupTempRoot(tempRoot);
    }
  });

  test("start() can start worker when FREE_AI_MIXER_ENABLE_WORKER_STARTUP=1 and FREE_AI_MIXER_ENABLE_WORKER_LOOP=1", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();

    const rendererAdapter = async (): Promise<RendererAdapterResult> => ({ ok: true });

    const originalEnv = process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP;
    process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP = "1";
    const originalLoopEnv = process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
    process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = "1";

    const controller = createRenderWorkerStartup(registry, rendererAdapter, {
      roots: {
        temp: path.join(tempRoot, "temp"),
        output: path.join(tempRoot, "output"),
      },
    });

    controller.start();
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      expect(controller.isRunning()).toBe(true);
      expect(controller.getStatus().startupEnabled).toBe(true);
    } finally {
      controller.stop();
      process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP = originalEnv ?? "";
      process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = originalLoopEnv ?? "";
      await cleanupTempRoot(tempRoot);
    }
  });

  test("stop() is idempotent and clears running state", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();

    const rendererAdapter = async (): Promise<RendererAdapterResult> => ({ ok: true });

    const originalEnv = process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP;
    process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP = "1";
    const originalLoopEnv = process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
    process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = "1";

    const controller = createRenderWorkerStartup(registry, rendererAdapter, {
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
    expect(controller.isRunning()).toBe(false);

    controller.stop();
    expect(controller.isRunning()).toBe(false);

    try {
      expect(controller.isRunning()).toBe(false);
    } finally {
      process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP = originalEnv ?? "";
      process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = originalLoopEnv ?? "";
      await cleanupTempRoot(tempRoot);
    }
  });

  test("startup factory reuses createRenderWorkerLoop rather than duplicating loop logic", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/workers/renderWorkerStartup.ts"),
      "utf8",
    );

    expect(source).toContain("createRenderWorkerLoop");
    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("setTimeout");
    expect(source).not.toContain("drainRenderWorkerOnce");
  });

  test("startup factory does not directly call executeSingleProcessRender or registry lifecycle mutation methods", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/workers/renderWorkerStartup.ts"),
      "utf8",
    );

    expect(source).not.toContain("executeSingleProcessRender");
    expect(source).not.toContain("registry.claim(");
    expect(source).not.toContain("registry.markRendering(");
    expect(source).not.toContain("registry.markFinalizing(");
    expect(source).not.toContain("registry.markSuccess(");
    expect(source).not.toContain("registry.markError(");
  });

  test("startup status does not expose local path, filePath, path, url, artifactUrl, downloadUrl, or signedUrl", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/workers/renderWorkerStartup.ts"),
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