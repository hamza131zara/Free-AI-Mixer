import { expect, test } from "@playwright/test";
import express from "express";
import os from "node:os";
import path from "node:path";
import { createLocalDevArtifactAccessProvider } from "../../backend/artifacts/localDevArtifactAccessProvider";
import type { ArtifactStorageRefResolver } from "../../backend/artifacts/artifactStorageRefResolver";
import type { InternalArtifactStorageRef } from "../../backend/artifacts/internalArtifactStorageRef";
import type { BackendArtifactAccessResponse, BackendExportJobRecord } from "../../backend/contracts/exportHttpTypes";
import { exportErrorHandler } from "../../backend/errors/exportErrors";
import { InMemoryExportJobRegistry } from "../../backend/registry/inMemoryExportJobRegistry";
import { createExportRouter } from "../../backend/routes/exports";

const workerId = "phase14-smoke-worker";

const createSuccessfulJob = (): BackendExportJobRecord => ({
  jobId: "job-phase14-smoke",
  requestId: "request-phase14-smoke",
  timelineId: "timeline-phase14-smoke",
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
      artifactId: "artifact-phase14-smoke",
      jobId: "job-phase14-smoke",
      kind: "render_output",
      format: "mp4",
      status: "available",
      createdAt: "2026-01-01T00:00:00.000Z",
      sizeBytes: 1024,
    },
  ],
});

const createRegistry = () =>
  new InMemoryExportJobRegistry({
    seed: {
      jobs: [createSuccessfulJob()],
    },
  });

const createSafeLookingMissingRef = (): InternalArtifactStorageRef => {
  const rootPath = path.join(os.tmpdir(), "free-ai-mixer-phase14-missing-root");
  const directoryPath = path.join(rootPath, "job-phase14-smoke");
  const filePath = path.join(directoryPath, "artifact-phase14-smoke.mp4");

  return {
    rootPath,
    directoryPath,
    filePath,
    jobSegment: "job-phase14-smoke",
  };
};

interface TestServerContext {
  baseUrl: string;
  close: () => Promise<void>;
}

const startServer = async (options?: {
  artifactStorageRefResolver?: ArtifactStorageRefResolver;
  includeLocalDevProvider?: boolean;
}): Promise<TestServerContext> => {
  const app = express();
  const registry = createRegistry();

  const artifactStorageRefResolver = options?.artifactStorageRefResolver;
  const artifactAccessProvider = options?.includeLocalDevProvider && artifactStorageRefResolver
    ? createLocalDevArtifactAccessProvider({
        resolveArtifactStorageRef: (request) =>
          artifactStorageRefResolver.resolve(request.jobId, request.artifactId),
        streamUrlForArtifact: (request) =>
          `/exports/${encodeURIComponent(request.jobId)}/artifacts/${encodeURIComponent(request.artifactId)}/stream`,
        isPathWithinRoot: () => true,
      })
    : undefined;

  app.use(
    createExportRouter(registry, {
      ...(artifactStorageRefResolver ? { artifactStorageRefResolver } : {}),
      ...(artifactAccessProvider ? { artifactAccessProvider } : {}),
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

const expectNoPathLeak = (value: unknown): void => {
  const body = JSON.stringify(value);
  expect(body).not.toContain("filePath");
  expect(body).not.toContain("rootPath");
  expect(body).not.toContain("directoryPath");
  expect(body).not.toContain("jobSegment");
};

test.describe("phase14 local-dev artifact access behavior smoke", () => {
  test("disabled router keeps access unavailable/not-configured and stream unconfigured", async () => {
    const server = await startServer();

    try {
      const accessResponse = await fetch(
        `${server.baseUrl}/exports/job-phase14-smoke/artifacts/artifact-phase14-smoke/access`,
      );

      expect(accessResponse.status).toBe(200);
      const accessBody = await accessResponse.json() as BackendArtifactAccessResponse;

      expect(accessBody.kind).toBe("artifact_access_unavailable");
      if (accessBody.kind !== "artifact_access_unavailable") {
        throw new Error("Expected artifact_access_unavailable response.");
      }

      expect(accessBody.reason).toBe("artifact_access_not_configured");
      expect(accessBody).not.toHaveProperty("access");
      expectNoPathLeak(accessBody);

      const accessBodyString = JSON.stringify(accessBody);
      expect(accessBodyString).not.toContain("signed_url");
      expect(accessBodyString).not.toContain("expiresAt");

      const streamResponse = await fetch(
        `${server.baseUrl}/exports/job-phase14-smoke/artifacts/artifact-phase14-smoke/stream`,
      );

      expect(streamResponse.status).toBe(501);
      const streamBody = await streamResponse.json() as { code: string; message: string };
      expect(streamBody.code).toBe("stream_not_configured");
      expectNoPathLeak(streamBody);
    } finally {
      await server.close();
    }
  });

  test("enabled router returns local_dev_stream descriptor without path leakage", async () => {
    const artifactStorageRefResolver: ArtifactStorageRefResolver = {
      resolve: () => createSafeLookingMissingRef(),
    };
    const server = await startServer({
      artifactStorageRefResolver,
      includeLocalDevProvider: true,
    });

    try {
      const response = await fetch(
        `${server.baseUrl}/exports/job-phase14-smoke/artifacts/artifact-phase14-smoke/access`,
      );

      expect(response.status).toBe(200);
      const body = await response.json() as BackendArtifactAccessResponse;

      expect(body.kind).toBe("artifact_access_ready");
      if (body.kind !== "artifact_access_ready") {
        throw new Error("Expected artifact_access_ready response.");
      }

      expect(body.access.kind).toBe("local_dev_stream");
      expect(body.access.url).toBe(
        "/exports/job-phase14-smoke/artifacts/artifact-phase14-smoke/stream",
      );
      expect(body.access.method).toBe("GET");
      expect(body.artifact.artifactId).toBe("artifact-phase14-smoke");
      expect(body.artifact.jobId).toBe("job-phase14-smoke");
      expectNoPathLeak(body);

      const bodyString = JSON.stringify(body);
      expect(bodyString).not.toContain("signed_url");
      expect(bodyString).not.toContain("expiresAt");
    } finally {
      await server.close();
    }
  });

  test("enabled router still requires stream-route validation and does not serve fake refs", async () => {
    const artifactStorageRefResolver: ArtifactStorageRefResolver = {
      resolve: () => createSafeLookingMissingRef(),
    };
    const server = await startServer({
      artifactStorageRefResolver,
      includeLocalDevProvider: true,
    });

    try {
      const response = await fetch(
        `${server.baseUrl}/exports/job-phase14-smoke/artifacts/artifact-phase14-smoke/stream`,
      );

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);

      const body = await response.json() as { code: string; message: string };
      expect(body.code).toBe("internal_error");
      expect(body.message).toBe("Artifact stream failed.");
      expectNoPathLeak(body);
    } finally {
      await server.close();
    }
  });
});
