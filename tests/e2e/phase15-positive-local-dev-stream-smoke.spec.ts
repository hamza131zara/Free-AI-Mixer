import { expect, test } from "@playwright/test";
import express from "express";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import type { ArtifactStorageRefResolver } from "../../backend/artifacts/artifactStorageRefResolver";
import type { InternalArtifactStorageRef } from "../../backend/artifacts/internalArtifactStorageRef";
import type { BackendExportJobRecord } from "../../backend/contracts/exportHttpTypes";
import { exportErrorHandler } from "../../backend/errors/exportErrors";
import { InMemoryExportJobRegistry } from "../../backend/registry/inMemoryExportJobRegistry";
import { createExportRouter } from "../../backend/routes/exports";

const workerId = "phase15-smoke-worker";
const jobId = "job-phase15-smoke";
const artifactId = "artifact-phase15-smoke";
const payload = "phase15-stream-smoke";

const createSuccessfulJob = (): BackendExportJobRecord => ({
  jobId,
  requestId: "request-phase15-smoke",
  timelineId: "timeline-phase15-smoke",
  status: "success",
  attemptCount: 1,
  claimedByWorkerId: workerId,
  claimExpiresAt: "2026-12-31T00:00:00.000Z",
  startedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  completedAt: "2026-01-01T00:00:00.000Z",
  renderSettings: {
    format: "mp4",
    resolution: "1080p",
    fps: 30,
    quality: "standard",
  },
  artifacts: [
    {
      artifactId,
      jobId,
      kind: "render_output",
      format: "mp4",
      status: "available",
      createdAt: "2026-01-01T00:00:00.000Z",
      sizeBytes: Buffer.byteLength(payload),
    },
  ],
});

const createRegistry = () =>
  new InMemoryExportJobRegistry({
    seed: {
      jobs: [createSuccessfulJob()],
    },
  });

interface TestServerContext {
  baseUrl: string;
  close: () => Promise<void>;
}

const startServer = async (
  artifactStorageRefResolver: ArtifactStorageRefResolver,
): Promise<TestServerContext> => {
  const app = express();
  const registry = createRegistry();

  app.use(
    createExportRouter(registry, {
      artifactStorageRefResolver,
    }),
  );
  app.use(exportErrorHandler);

  const server = app.listen(0);

  await new Promise<void>((resolve) => {
    server.on("listening", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected ephemeral test server address.");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
};

test.describe("phase15 positive local-dev stream smoke", () => {
  test("stream route serves a real temp file after validation passes", async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "free-ai-mixer-phase15-stream-"),
    );
    const jobSegment = "job-phase15-smoke";
    const directoryPath = path.join(tempRoot, jobSegment);
    const filePath = path.join(directoryPath, `${artifactId}.mp4`);

    await fs.mkdir(directoryPath, { recursive: true });
    await fs.writeFile(filePath, payload, "utf8");

    const storageRef: InternalArtifactStorageRef = {
      rootPath: tempRoot,
      directoryPath,
      jobSegment,
      filePath,
    };

    const artifactStorageRefResolver: ArtifactStorageRefResolver = {
      resolve: (resolvedJobId, resolvedArtifactId) =>
        resolvedJobId === jobId && resolvedArtifactId === artifactId
          ? storageRef
          : undefined,
    };

    const server = await startServer(artifactStorageRefResolver);

    try {
      const response = await fetch(
        `${server.baseUrl}/exports/${jobId}/artifacts/${artifactId}/stream`,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("video/mp4");
      expect(response.headers.get("content-disposition")).toContain("attachment;");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");

      const body = await response.text();
      expect(body).toBe(payload);
      expect(body).not.toContain('"code"');
      expect(body).not.toContain('"message"');
    } finally {
      await server.close();
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
