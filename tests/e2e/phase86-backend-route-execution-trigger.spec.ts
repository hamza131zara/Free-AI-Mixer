import { expect, test } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import express, { type Express } from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { InMemoryExportJobRegistry } from "../../backend/registry/exportJobRegistry";
import { createExportRouter } from "../../backend/routes/exports";
import type {
  RendererAdapterInput,
  RendererAdapterResult,
} from "../../backend/renderer/singleProcessRenderHarness";

const createTempRoot = async (): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), "phase86-trigger-"));

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

const createTestApp = (registry: InMemoryExportJobRegistry, options?: any): Express => {
  const app = express();
  app.use(createExportRouter(registry, options));
  return app;
};

test.describe("phase86 backend route execution trigger", () => {
  test("POST /exports remains non-executing and creates job only", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );

    const postExportStart = source.indexOf('router.post(\n    "/exports"');
    const nextRouterDef = source.indexOf("router.", postExportStart + 20);
    const postExportHandler = source.slice(postExportStart, nextRouterDef);

    expect(postExportHandler).not.toContain("executeRenderJob");
    expect(postExportHandler).not.toContain("executeSingleProcessRender");
    expect(postExportHandler).toContain("202");
    expect(postExportHandler).toContain("accepted_job");
  });

  test("trigger route returns 503 when env flag is missing", async () => {
    const registry = new InMemoryExportJobRegistry();
    const app = createTestApp(registry);

    const job = registry.create({
      requestId: "phase86-disabled-test",
      timelineId: "phase86-timeline",
      renderSettings: {
        format: "mp4",
        resolution: "720p",
        fps: 24,
        quality: "draft",
      },
    });

    let server: Server;
    let baseUrl: string;

    server = await new Promise<Server>((resolve) => {
      const instance = app.listen(0, () => resolve(instance));
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const response = await fetch(`${baseUrl}/exports/${job.jobId}/execute`, {
        method: "POST",
      });

      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.code).toBe("route_execution_disabled");
      expect(body.message).toContain("FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION=1");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });

  test("trigger route delegates safely when env flag is enabled with mocked executor", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();

    const rendererAdapter = async (
      input: RendererAdapterInput,
    ): Promise<RendererAdapterResult> => {
      await fs.mkdir(input.resolvedOutputPath.directoryPath, { recursive: true });
      await fs.writeFile(input.resolvedOutputPath.filePath, Buffer.from("phase86-video"));
      return { ok: true };
    };

    const app = createTestApp(registry, {
      rendererAdapter,
      pathPolicy: {
        roots: {
          temp: path.join(tempRoot, "temp"),
          output: path.join(tempRoot, "output"),
        },
      },
    });

    const job = registry.create({
      requestId: "phase86-enabled-test",
      timelineId: "phase86-timeline",
      renderSettings: {
        format: "mp4",
        resolution: "720p",
        fps: 24,
        quality: "draft",
      },
    });

    let server: Server;
    let baseUrl: string;

    server = await new Promise<Server>((resolve) => {
      const instance = app.listen(0, () => resolve(instance));
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const originalEnv = process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION;
    process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION = "1";

    try {
      const response = await fetch(`${baseUrl}/exports/${job.jobId}/execute`, {
        method: "POST",
      });

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.kind).toBe("executed");
      expect(body.jobId).toBe(job.jobId);
      expect(body.status).toBe("success");
      expect(body.artifact).toBeDefined();
      expect(body.artifact.artifactId).toBeDefined();
      expect(body.artifact.jobId).toBe(job.jobId);
      expect(body.artifact.kind).toBe("render_output");
      expect(body.artifact.format).toBe("mp4");
      expect(body.artifact.status).toBe("available");
      expect(body.artifact.sizeBytes).toBeGreaterThan(0);
      expect(body.artifact.path).toBeUndefined();
      expect(body.artifact.filePath).toBeUndefined();
      expect(body.artifact.localPath).toBeUndefined();
      expect(body.artifact.url).toBeUndefined();
      expect(body.artifact.downloadUrl).toBeUndefined();
      expect(body.artifact.publicUrl).toBeUndefined();
      expect(body.artifact.signedUrl).toBeUndefined();

      const storedJob = registry.getById(job.jobId);
      expect(storedJob?.status).toBe("success");
    } finally {
      process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION = originalEnv ?? "";
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await cleanupTempRoot(tempRoot);
    }
  });

  test("trigger route does not directly call lifecycle mutation methods", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );

    const executeRouteStart = source.indexOf('router.post(\n    "/exports/:jobId/execute"');
    if (executeRouteStart === -1) {
      throw new Error("Could not find execute route");
    }
    const afterExecuteRoute = source.indexOf("router.get(", executeRouteStart);
    const executeRouteHandler = source.slice(executeRouteStart, afterExecuteRoute);

    expect(executeRouteHandler).not.toContain("registry.claim(");
    expect(executeRouteHandler).not.toContain("registry.markRendering(");
    expect(executeRouteHandler).not.toContain("registry.markFinalizing(");
    expect(executeRouteHandler).not.toContain("registry.markSuccess(");
    expect(executeRouteHandler).not.toContain("registry.markError(");
    expect(executeRouteHandler).toContain("executeRenderJob");
  });

  test("trigger route returns error when executor not configured", async () => {
    const registry = new InMemoryExportJobRegistry();
    const app = createTestApp(registry);

    const job = registry.create({
      requestId: "phase86-no-config-test",
      timelineId: "phase86-timeline",
      renderSettings: {
        format: "mp4",
        resolution: "720p",
        fps: 24,
        quality: "draft",
      },
    });

    let server: Server;
    let baseUrl: string;

    server = await new Promise<Server>((resolve) => {
      const instance = app.listen(0, () => resolve(instance));
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const originalEnv = process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION;
    process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION = "1";

    try {
      const response = await fetch(`${baseUrl}/exports/${job.jobId}/execute`, {
        method: "POST",
      });

      expect(response.status).toBe(501);
      const body = await response.json();
      expect(body.code).toBe("executor_not_configured");
      expect(body.message).toContain("rendererAdapter or pathPolicy not configured");
    } finally {
      process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION = originalEnv ?? "";
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });
});