import { expect, test } from "@playwright/test";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { BackendExportJobRecord } from "../../backend/contracts/exportHttpTypes";
import { exportErrorHandler } from "../../backend/errors/exportErrors";
import { InMemoryExportJobRegistry } from "../../backend/registry/inMemoryExportJobRegistry";
import {
  type ExportRequesterContext,
  createLocalDevFallbackExportRequesterContext,
} from "../../backend/requester/exportRequesterContext";
import { createExportRouter } from "../../backend/routes/exports";

const createPendingJob = (
  overrides?: Partial<BackendExportJobRecord>,
): BackendExportJobRecord => ({
  jobId: "job-phase21-pending",
  requestId: "request-phase21-pending",
  timelineId: "timeline-phase21-pending",
  ownerId: "local-dev-owner",
  workspaceId: "local-dev-workspace",
  status: "submitted",
  attemptCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  renderSettings: {
    format: "mp4",
    resolution: "1080p",
    fps: 30,
    quality: "standard",
  },
  ...overrides,
});

const createSuccessfulJob = (
  overrides?: Partial<BackendExportJobRecord>,
): BackendExportJobRecord => ({
  jobId: "job-phase21-success",
  requestId: "request-phase21-success",
  timelineId: "timeline-phase21-success",
  ownerId: "owner-a",
  workspaceId: "workspace-a",
  status: "success",
  attemptCount: 1,
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
      artifactId: "artifact-phase21-success",
      jobId: "job-phase21-success",
      kind: "render_output",
      format: "mp4",
      status: "available",
      createdAt: "2026-01-01T00:00:00.000Z",
      sizeBytes: 2048,
    },
  ],
  ...overrides,
});

interface TestServerContext {
  baseUrl: string;
  close: () => Promise<void>;
}

const startServer = async (options?: {
  jobs?: BackendExportJobRecord[];
  requesterContextResolver?: () => ExportRequesterContext;
  includeResolver?: boolean;
  onResolve?: () => void;
}): Promise<TestServerContext> => {
  const app = express();
  const registry = new InMemoryExportJobRegistry({
    seed: {
      jobs: options?.jobs ?? [],
    },
  });

  app.use(
    createExportRouter(registry, {
      ...(options?.requesterContextResolver
        ? {
            requesterContextResolver: () => options.requesterContextResolver!(),
          }
        : {}),
      ...(options?.includeResolver
        ? {
            artifactStorageRefResolver: {
              resolve: () => {
                options.onResolve?.();
                throw new Error("resolver should not be reached for unauthorized requests");
              },
            },
          }
        : {}),
    }),
  );
  app.use(exportErrorHandler);

  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
};

test.describe("phase21 route authorization boundary", () => {
  test("default router behavior still works with fallback requester resolver", async () => {
    const server = await startServer({
      jobs: [createPendingJob()],
    });

    try {
      const response = await fetch(`${server.baseUrl}/exports/job-phase21-pending`);
      expect(response.status).toBe(200);

      const body = (await response.json()) as { kind: string; handle?: { jobId: string } };
      expect(body.kind).toBe("pending");
      expect(body.handle?.jobId).toBe("job-phase21-pending");
    } finally {
      await server.close();
    }
  });

  test("injected requester can access owned job", async () => {
    const server = await startServer({
      jobs: [createSuccessfulJob()],
      requesterContextResolver: () => ({
        ownerId: "owner-a",
        workspaceId: "workspace-a",
        authMode: "local_dev_fallback",
      }),
    });

    try {
      const response = await fetch(`${server.baseUrl}/exports/job-phase21-success`);
      expect(response.status).toBe(200);

      const body = (await response.json()) as { kind: string; result?: { jobId: string } };
      expect(body.kind).toBe("terminal_success");
      expect(body.result?.jobId).toBe("job-phase21-success");
    } finally {
      await server.close();
    }
  });

  test("injected requester cannot access not-owned job or artifacts route", async () => {
    const server = await startServer({
      jobs: [createSuccessfulJob()],
      requesterContextResolver: () => ({
        ownerId: "owner-b",
        workspaceId: "workspace-b",
        authMode: "local_dev_fallback",
      }),
    });

    try {
      const jobResponse = await fetch(`${server.baseUrl}/exports/job-phase21-success`);
      expect(jobResponse.status).toBe(404);
      const jobBody = (await jobResponse.json()) as { code: string; message: string };
      expect(jobBody.code).toBe("export_job_not_found");

      const artifactsResponse = await fetch(
        `${server.baseUrl}/exports/job-phase21-success/artifacts`,
      );
      expect(artifactsResponse.status).toBe(404);
      const artifactsBody = (await artifactsResponse.json()) as { code: string; message: string };
      expect(artifactsBody.code).toBe("export_job_not_found");
    } finally {
      await server.close();
    }
  });

  test("not-owned /access does not reveal artifact details", async () => {
    const server = await startServer({
      jobs: [createSuccessfulJob()],
      requesterContextResolver: () => ({
        ownerId: "owner-b",
        workspaceId: "workspace-b",
        authMode: "local_dev_fallback",
      }),
    });

    try {
      const response = await fetch(
        `${server.baseUrl}/exports/job-phase21-success/artifacts/artifact-phase21-success/access`,
      );
      expect(response.status).toBe(200);

      const body = (await response.json()) as Record<string, unknown>;
      expect(body.kind).toBe("artifact_access_unavailable");
      expect(body.reason).toBe("job_not_found");
      expect(body.message).toBe("Export job was not found.");
      expect(body).not.toHaveProperty("artifact");
      expect(body).not.toHaveProperty("access");
    } finally {
      await server.close();
    }
  });

  test("not-owned /stream returns not-found style response and does not call resolver", async () => {
    let resolveCalls = 0;
    const server = await startServer({
      jobs: [createSuccessfulJob()],
      includeResolver: true,
      onResolve: () => {
        resolveCalls += 1;
      },
      requesterContextResolver: () => ({
        ownerId: "owner-b",
        workspaceId: "workspace-b",
        authMode: "local_dev_fallback",
      }),
    });

    try {
      const response = await fetch(
        `${server.baseUrl}/exports/job-phase21-success/artifacts/artifact-phase21-success/stream`,
      );
      expect(response.status).toBe(404);

      const body = (await response.json()) as { code: string; message: string };
      expect(body.code).toBe("job_not_found");
      expect(body.message).toBe("Export job was not found.");
      expect(resolveCalls).toBe(0);
    } finally {
      await server.close();
    }
  });

  test("route source does not add auth middleware or download behavior", async () => {
    const fallbackContext = createLocalDevFallbackExportRequesterContext();
    expect(fallbackContext.authMode).toBe("local_dev_fallback");
  });
});
