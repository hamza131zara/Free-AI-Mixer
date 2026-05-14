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
  fs.mkdtemp(path.join(os.tmpdir(), "phase87-timeout-"));

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

test.describe("phase87 route execution timeout", () => {
  test("route returns 504 when execution exceeds configured timeout", async () => {
    const tempRoot = await createTempRoot();
    const registry = new InMemoryExportJobRegistry();

    const slowRendererAdapter = async (
      input: RendererAdapterInput,
    ): Promise<RendererAdapterResult> => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await fs.mkdir(input.resolvedOutputPath.directoryPath, { recursive: true });
      await fs.writeFile(input.resolvedOutputPath.filePath, Buffer.from("phase87-video"));
      return { ok: true };
    };

    const app = createTestApp(registry, {
      rendererAdapter: slowRendererAdapter,
      pathPolicy: {
        roots: {
          temp: path.join(tempRoot, "temp"),
          output: path.join(tempRoot, "output"),
        },
      },
    });

    const job = registry.create({
      requestId: "phase87-timeout-test",
      timelineId: "phase87-timeline",
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
    const originalTimeout = process.env.FREE_AI_MIXER_ROUTE_EXECUTION_TIMEOUT_MS;
    process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION = "1";
    process.env.FREE_AI_MIXER_ROUTE_EXECUTION_TIMEOUT_MS = "100";

    try {
      const response = await fetch(`${baseUrl}/exports/${job.jobId}/execute`, {
        method: "POST",
      });

      expect(response.status).toBe(504);
      const body = await response.json();
      expect(body.code).toBe("route_execution_timeout");
      expect(body.message).toContain("timed out");
      expect(body.jobId).toBe(job.jobId);
      expect(body.path).toBeUndefined();
      expect(body.filePath).toBeUndefined();
      expect(body.localPath).toBeUndefined();
      expect(body.url).toBeUndefined();
      expect(body.downloadUrl).toBeUndefined();
      expect(body.signedUrl).toBeUndefined();
      expect(body.artifact).toBeUndefined();
    } finally {
      process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION = originalEnv ?? "";
      if (originalTimeout !== undefined) {
        process.env.FREE_AI_MIXER_ROUTE_EXECUTION_TIMEOUT_MS = originalTimeout;
      } else {
        delete process.env.FREE_AI_MIXER_ROUTE_EXECUTION_TIMEOUT_MS;
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await cleanupTempRoot(tempRoot);
    }
  });

  test("timeout is env-configurable using FREE_AI_MIXER_ROUTE_EXECUTION_TIMEOUT_MS", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );

    expect(source).toContain("FREE_AI_MIXER_ROUTE_EXECUTION_TIMEOUT_MS");
    expect(source).toContain("getRouteExecutionTimeout");
    expect(source).toContain("120000");
  });

  test("timeout response has no local path, filePath, path, url, artifact, downloadUrl, or signedUrl", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );

    const executeRouteStart = source.indexOf('router.post(\n    "/exports/:jobId/execute"');
    if (executeRouteStart === -1) {
      throw new Error("Could not find execute route");
    }
    const executeRouteEnd = source.indexOf("return router;", executeRouteStart);
    const executeRouteHandler = source.slice(executeRouteStart, executeRouteEnd);

    expect(executeRouteHandler).toContain("504");
    expect(executeRouteHandler).toContain("route_execution_timeout");
    expect(executeRouteHandler).toContain("timed out");
    expect(executeRouteHandler).not.toContain("path:");
    expect(executeRouteHandler).not.toContain("filePath:");
    expect(executeRouteHandler).not.toContain("downloadUrl");
    expect(executeRouteHandler).not.toContain("signedUrl");
    expect(executeRouteHandler).not.toContain("registry.markSuccess");
    expect(executeRouteHandler).not.toContain("registry.markError");
    expect(executeRouteHandler).not.toContain("registry.markFinalizing");
  });

  test("route does not directly call lifecycle mutation methods", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );

    const executeRouteStart = source.indexOf('router.post(\n    "/exports/:jobId/execute"');
    if (executeRouteStart === -1) {
      throw new Error("Could not find execute route");
    }
    const executeRouteEnd = source.indexOf("return router;", executeRouteStart);
    const executeRouteHandler = source.slice(executeRouteStart, executeRouteEnd);

    expect(executeRouteHandler).not.toContain("registry.claim(");
    expect(executeRouteHandler).not.toContain("registry.markRendering(");
    expect(executeRouteHandler).not.toContain("registry.markFinalizing(");
    expect(executeRouteHandler).not.toContain("registry.markSuccess(");
    expect(executeRouteHandler).not.toContain("registry.markError(");
    expect(executeRouteHandler).toContain("executeRenderJob");
  });
});