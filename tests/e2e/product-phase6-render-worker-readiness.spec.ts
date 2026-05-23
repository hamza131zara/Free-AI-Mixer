import { expect, test } from "@playwright/test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import path from "node:path";
import { createApp } from "../../backend/app";
import { createBackendDependencies } from "../../backend/composition/backendDependencies";
import { createRenderWorkerLifecycle } from "../../backend/workers/renderWorkerLifecycle";
import type { TimelineExportRequest } from "../../src/types/exportJob";
const projectRoot = process.cwd();

const startServer = async (): Promise<{ server: Server; baseUrl: string }> => {
  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
};

const stopServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const createExportRequest = (): TimelineExportRequest => ({
  requestId: "phase6-request",
  timelineId: "timeline-phase6",
  renderSettings: {
    format: "mp4",
    resolution: "1080p",
    fps: 30,
    quality: "standard",
  },
  requestedAt: "2026-01-01T00:00:00.000Z",
  snapshot: {
    snapshotVersion: 1,
    timelineSnapshot: {
      timelineId: "timeline-phase6",
      clips: [
        {
          clipId: "clip-a",
          sceneRefId: "scene-a",
          startMs: 0,
          durationMs: 3000,
          order: 0,
        },
      ],
    },
    sceneRefs: [{ sceneId: "scene-a", role: "primary", contentType: "image" }],
    mediaRefs: [
      {
        mediaId: "scene-media:scene-a:selected",
        role: "selected",
        contentType: "image",
      },
    ],
  },
});

test.describe("product phase 6 render worker readiness", () => {
  test("export execute route remains gated and submitted jobs do not fake success by default", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const submitResponse = await fetch(`${baseUrl}/exports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createExportRequest()),
      });

      expect(submitResponse.status).toBe(202);
      const submitBody = (await submitResponse.json()) as {
        kind: string;
        handle: { jobId: string };
      };
      expect(submitBody.kind).toBe("accepted_job");

      const pollResponse = await fetch(`${baseUrl}/exports/${submitBody.handle.jobId}`);
      expect(pollResponse.status).toBe(200);
      await expect(pollResponse.json()).resolves.toMatchObject({
        kind: "pending",
        handle: {
          jobId: submitBody.handle.jobId,
          status: "submitted",
        },
      });

      const executeResponse = await fetch(
        `${baseUrl}/exports/${submitBody.handle.jobId}/execute`,
        {
          method: "POST",
        },
      );
      expect(executeResponse.status).toBe(503);
      await expect(executeResponse.json()).resolves.toEqual({
        code: "route_execution_disabled",
        message:
          "Route execution is disabled. Set FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION=1 to enable.",
      });

      const deliveryResponse = await fetch(
        `${baseUrl}/exports/${submitBody.handle.jobId}/artifacts/fake-artifact/delivery`,
      );
      expect(deliveryResponse.status).toBe(200);
      const deliveryBody = (await deliveryResponse.json()) as Record<string, unknown>;
      expect(deliveryBody.kind).toBe("artifact_delivery_unavailable");
      expect(deliveryBody).not.toHaveProperty("signedUrl");
      expect(deliveryBody).not.toHaveProperty("url");
    } finally {
      await stopServer(server);
    }
  });

  test("worker startup and worker loop remain gated by env flags", () => {
    const originalStartup = process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP;
    const originalLoop = process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
    delete process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP;
    delete process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;

    const deps = createBackendDependencies();
    const lifecycle = createRenderWorkerLifecycle(
      deps.registry,
      deps.rendererAdapter,
      deps.pathPolicy,
      deps.onVerifiedArtifactRef,
      deps.renderInputSnapshotStore,
    );

    lifecycle.init();

    try {
      expect(lifecycle.isRunning()).toBe(false);
      expect(lifecycle.getStatus().startupStatus.startupEnabled).toBe(false);
      expect(lifecycle.getStatus().startupStatus.loopRunning).toBe(false);
    } finally {
      lifecycle.shutdown();
      if (originalStartup !== undefined) {
        process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP = originalStartup;
      }
      if (originalLoop !== undefined) {
        process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = originalLoop;
      }
    }
  });

  test("default renderer runtime still fails closed without enabling real render by default", async () => {
    const deps = createBackendDependencies();
    const renderResult = await deps.rendererAdapter({
      snapshot: {
        snapshotVersion: 1,
        jobId: "phase6-job",
        timelineId: "timeline-phase6",
        renderSettings: {
          format: "mp4",
          resolution: "1080p",
          fps: 30,
          quality: "standard",
        },
        timelineSnapshot: {
          timelineId: "timeline-phase6",
          clips: [
            {
              clipId: "clip-a",
              sceneRefId: "scene-a",
              startMs: 0,
              durationMs: 3000,
              order: 0,
            },
          ],
        },
        sceneRefs: [{ sceneId: "scene-a", role: "primary" }],
        mediaRefs: [{ mediaId: "scene-media:scene-a:selected" }],
        outputTarget: {
          jobFolderKey: "phase6-job",
          artifactBaseName: "output",
          format: "mp4",
        },
      },
      resolvedOutputPath: {
        rootKey: "output",
        rootPath: path.join(projectRoot, ".free-ai-mixer-output"),
        jobSegment: "phase6-job",
        directoryPath: path.join(projectRoot, ".free-ai-mixer-output", "phase6-job"),
        filePath: path.join(
          projectRoot,
          ".free-ai-mixer-output",
          "phase6-job",
          "output.mp4",
        ),
      },
    });

    expect(renderResult.ok).toBe(false);
  });
});
