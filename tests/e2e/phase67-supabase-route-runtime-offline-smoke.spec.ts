import { expect, test } from "@playwright/test";
import express from "express";
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { exportErrorHandler } from "../../backend/errors/exportErrors";
import type {
  BackendExportJobOwnerScope,
  BackendExportJobRecord,
} from "../../backend/contracts/exportHttpTypes";
import { createExportRouter } from "../../backend/routes/exports";
import type {
  CreateExportJobInput,
  ExportJobRegistry,
} from "../../backend/registry/exportJobRegistry";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase67-supabase-route-runtime-offline-smoke.spec.ts",
);
const routesPath = path.join(process.cwd(), "backend", "routes", "exports.ts");
const appPath = path.join(process.cwd(), "backend", "app.ts");
const renderWorkerPath = path.join(
  process.cwd(),
  "backend",
  "workers",
  "renderWorker.ts",
);

const ROUTE_ENV_KEYS = [
  "FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION",
  "FREE_AI_MIXER_ROUTE_EXECUTION_TIMEOUT_MS",
] as const;

const defaultOwnerScope: BackendExportJobOwnerScope = {
  ownerId: "local-dev-owner",
  workspaceId: "local-dev-workspace",
};

const readFileSource = async (filePath: string): Promise<string> =>
  fs.readFile(filePath, "utf8");

const withEnv = async (
  values: Partial<Record<(typeof ROUTE_ENV_KEYS)[number], string>>,
  run: () => Promise<void>,
): Promise<void> => {
  const previous = new Map<string, string | undefined>();

  for (const key of ROUTE_ENV_KEYS) {
    previous.set(key, process.env[key]);
    const value = values[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    await run();
  } finally {
    for (const key of ROUTE_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

const buildForbiddenSecretLoggingPattern = (): string =>
  [
    "console",
    "log(process",
    "env",
    ["FREE", "AI", "MIXER", "SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"),
    ")",
  ].join(".");

const buildForbiddenCliPattern = (segment: string): string =>
  ["supabase", " ", segment].join("");

const createRecord = (
  overrides: Partial<BackendExportJobRecord> = {},
): BackendExportJobRecord => ({
  jobId: "job-phase67-default",
  requestId: "request-phase67-default",
  timelineId: "timeline-phase67-default",
  ownerId: defaultOwnerScope.ownerId,
  workspaceId: defaultOwnerScope.workspaceId,
  status: "submitted",
  attemptCount: 0,
  createdAt: "2026-05-20T12:00:00.000Z",
  updatedAt: "2026-05-20T12:00:00.000Z",
  renderSettings: {
    format: "mp4",
    resolution: "720p",
    fps: 24,
    quality: "draft",
  },
  ...overrides,
});

const startServer = async (
  registry: ExportJobRegistry,
): Promise<{ baseUrl: string; close: () => Promise<void> }> => {
  const app = express();
  app.use(express.json());
  app.use(createExportRouter(registry));
  app.use(exportErrorHandler);

  const server = http.createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected an ephemeral HTTP server address.");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
};

test.describe("phase67 supabase route runtime offline smoke", () => {
  test("offline router smoke covers submit, owner-scoped read mapping, not-found behavior, and execute-route gating without runtime wiring", async () => {
    const requestIdLookups: Array<{
      requestId: string;
      ownerScope?: BackendExportJobOwnerScope;
    }> = [];
    const creates: CreateExportJobInput[] = [];
    const ownerReads: Array<{
      jobId: string;
      ownerScope: BackendExportJobOwnerScope;
    }> = [];

    const createdRecord = createRecord({
      jobId: "job-phase67-created",
      requestId: "request-phase67-created",
      timelineId: "timeline-phase67-created",
    });
    const existingRecord = createRecord({
      jobId: "job-phase67-existing",
      requestId: "request-phase67-existing",
      timelineId: "timeline-phase67-existing",
    });
    const pendingRecord = createRecord({
      jobId: "job-phase67-pending",
      requestId: "request-phase67-pending",
      timelineId: "timeline-phase67-pending",
      status: "rendering",
      createdAt: "2026-05-20T12:01:00.000Z",
      updatedAt: "2026-05-20T12:02:00.000Z",
    });
    const successRecord = createRecord({
      jobId: "job-phase67-success",
      requestId: "request-phase67-success",
      timelineId: "timeline-phase67-success",
      status: "success",
      updatedAt: "2026-05-20T12:05:00.000Z",
      completedAt: "2026-05-20T12:05:00.000Z",
      artifacts: [
        {
          artifactId: "artifact-phase67-success",
          jobId: "job-phase67-success",
          kind: "render_output",
          format: "mp4",
          status: "available",
          createdAt: "2026-05-20T12:04:30.000Z",
          sizeBytes: 2048,
          durationMs: 1000,
        },
      ],
    });
    const errorRecord = createRecord({
      jobId: "job-phase67-error",
      requestId: "request-phase67-error",
      timelineId: "timeline-phase67-error",
      status: "error",
      updatedAt: "2026-05-20T12:06:00.000Z",
      failure: {
        code: "renderer_failed",
        message: "Renderer failed.",
      },
    });
    const executeRecord = createRecord({
      jobId: "job-phase67-execute",
      requestId: "request-phase67-execute",
      timelineId: "timeline-phase67-execute",
    });

    const fakeRegistry: ExportJobRegistry = {
      create: async (input) => {
        creates.push(input);
        return createdRecord;
      },
      getById: async () => undefined,
      getByIdForOwner: async (jobId, ownerScope) => {
        ownerReads.push({ jobId, ownerScope });
        switch (jobId) {
          case "job-phase67-pending":
            return pendingRecord;
          case "job-phase67-success":
            return successRecord;
          case "job-phase67-error":
            return errorRecord;
          case "job-phase67-execute":
            return executeRecord;
          default:
            return undefined;
        }
      },
      getByRequestId: async (requestId, ownerScope) => {
        requestIdLookups.push({ requestId, ownerScope });
        if (requestId === "request-phase67-existing") {
          return existingRecord;
        }
        return undefined;
      },
      getByStatus: async () => [],
      claim: async () => {
        throw new Error("claim should not be called in this offline route smoke");
      },
      markRendering: async () => {
        throw new Error(
          "markRendering should not be called in this offline route smoke",
        );
      },
      markFinalizing: async () => {
        throw new Error(
          "markFinalizing should not be called in this offline route smoke",
        );
      },
      markSuccess: async () => {
        throw new Error(
          "markSuccess should not be called in this offline route smoke",
        );
      },
      markError: async () => {
        throw new Error("markError should not be called in this offline route smoke");
      },
      transition: async () => {
        throw new Error(
          "transition should not be called in this offline route smoke",
        );
      },
    };

    const server = await startServer(fakeRegistry);

    try {
      const submitMissingResponse = await fetch(`${server.baseUrl}/exports`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requestId: "request-phase67-created",
          timelineId: "timeline-phase67-created",
          renderSettings: {
            format: "mp4",
            resolution: "720p",
            fps: 24,
            quality: "draft",
          },
          requestedAt: "2026-05-20T12:00:00.000Z",
        }),
      });

      expect(submitMissingResponse.status).toBe(202);
      await expect(submitMissingResponse.json()).resolves.toEqual({
        kind: "accepted_job",
        handle: {
          provider: "backend_render",
          requestId: "request-phase67-created",
          jobId: "job-phase67-created",
          status: "submitted",
          submittedAt: "2026-05-20T12:00:00.000Z",
        },
      });

      const submitExistingResponse = await fetch(`${server.baseUrl}/exports`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requestId: "request-phase67-existing",
          timelineId: "timeline-phase67-existing",
          renderSettings: {
            format: "mp4",
            resolution: "720p",
            fps: 24,
            quality: "draft",
          },
          requestedAt: "2026-05-20T12:00:01.000Z",
        }),
      });

      expect(submitExistingResponse.status).toBe(202);
      await expect(submitExistingResponse.json()).resolves.toEqual({
        kind: "accepted_job",
        handle: {
          provider: "backend_render",
          requestId: "request-phase67-existing",
          jobId: "job-phase67-existing",
          status: "submitted",
          submittedAt: "2026-05-20T12:00:00.000Z",
        },
      });

      expect(
        requestIdLookups.map((entry) => ({
          requestId: entry.requestId,
          ownerScope: {
            ownerId: entry.ownerScope?.ownerId,
            workspaceId: entry.ownerScope?.workspaceId,
          },
        })),
      ).toEqual([
        {
          requestId: "request-phase67-created",
          ownerScope: defaultOwnerScope,
        },
        {
          requestId: "request-phase67-existing",
          ownerScope: defaultOwnerScope,
        },
      ]);

      expect(creates).toEqual([
        {
          requestId: "request-phase67-created",
          timelineId: "timeline-phase67-created",
          renderSettings: {
            format: "mp4",
            resolution: "720p",
            fps: 24,
            quality: "draft",
          },
          ownerId: defaultOwnerScope.ownerId,
          workspaceId: defaultOwnerScope.workspaceId,
        },
      ]);

      const pendingResponse = await fetch(
        `${server.baseUrl}/exports/job-phase67-pending`,
      );
      expect(pendingResponse.status).toBe(200);
      await expect(pendingResponse.json()).resolves.toEqual({
        kind: "pending",
        handle: {
          provider: "backend_render",
          requestId: "request-phase67-pending",
          jobId: "job-phase67-pending",
          status: "rendering",
          submittedAt: "2026-05-20T12:01:00.000Z",
        },
      });

      const successResponse = await fetch(
        `${server.baseUrl}/exports/job-phase67-success`,
      );
      expect(successResponse.status).toBe(200);
      await expect(successResponse.json()).resolves.toEqual({
        kind: "terminal_success",
        result: {
          provider: "backend_render",
          requestId: "request-phase67-success",
          jobId: "job-phase67-success",
          artifacts: [
            {
              id: "artifact-phase67-success",
              status: "ready",
              bytes: 2048,
              metadata: {
                durationMs: 1000,
              },
            },
          ],
          completedAt: "2026-05-20T12:05:00.000Z",
        },
      });

      const errorResponse = await fetch(
        `${server.baseUrl}/exports/job-phase67-error`,
      );
      expect(errorResponse.status).toBe(200);
      await expect(errorResponse.json()).resolves.toEqual({
        kind: "terminal_failure",
        failure: {
          message: "Renderer failed.",
          code: "renderer_failed",
        },
        jobId: "job-phase67-error",
      });

      const notFoundResponse = await fetch(
        `${server.baseUrl}/exports/job-phase67-missing`,
      );
      expect(notFoundResponse.status).toBe(404);
      await expect(notFoundResponse.json()).resolves.toEqual({
        code: "export_job_not_found",
        message: "Export job was not found.",
        details: {
          jobId: "job-phase67-missing",
        },
      });

      await withEnv({}, async () => {
        const executeDisabledResponse = await fetch(
          `${server.baseUrl}/exports/job-phase67-execute/execute`,
          {
            method: "POST",
          },
        );

        expect(executeDisabledResponse.status).toBe(503);
        await expect(executeDisabledResponse.json()).resolves.toEqual({
          code: "route_execution_disabled",
          message:
            "Route execution is disabled. Set FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION=1 to enable.",
        });
      });

      await withEnv(
        {
          FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION: "1",
        },
        async () => {
          const executeUnconfiguredResponse = await fetch(
            `${server.baseUrl}/exports/job-phase67-execute/execute`,
            {
              method: "POST",
            },
          );

          expect(executeUnconfiguredResponse.status).toBe(501);
          await expect(executeUnconfiguredResponse.json()).resolves.toEqual({
            code: "executor_not_configured",
            message:
              "Execute trigger is enabled but rendererAdapter or pathPolicy not configured.",
          });
        },
      );

      expect(
        ownerReads.map((entry) => ({
          jobId: entry.jobId,
          ownerScope: {
            ownerId: entry.ownerScope.ownerId,
            workspaceId: entry.ownerScope.workspaceId,
          },
        })),
      ).toEqual([
        {
          jobId: "job-phase67-pending",
          ownerScope: defaultOwnerScope,
        },
        {
          jobId: "job-phase67-success",
          ownerScope: defaultOwnerScope,
        },
        {
          jobId: "job-phase67-error",
          ownerScope: defaultOwnerScope,
        },
        {
          jobId: "job-phase67-missing",
          ownerScope: defaultOwnerScope,
        },
        {
          jobId: "job-phase67-execute",
          ownerScope: defaultOwnerScope,
        },
      ]);
    } finally {
      await server.close();
    }
  });

  test("source guards keep the route smoke offline, with no CLI, secret logging, signed-url behavior, or worker activation implication", async () => {
    const [specSource, routesSource, appSource, renderWorkerSource] =
      await Promise.all([
        readFileSource(specPath),
        readFileSource(routesPath),
        readFileSource(appPath),
        readFileSource(renderWorkerPath),
      ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");

    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(routesSource).toContain(
      'process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION === "1"',
    );
    expect(routesSource).not.toContain("signedUrl");
    expect(routesSource).not.toContain("downloadUrl");
    expect(routesSource).not.toContain("storage_refs");
    expect(routesSource).not.toContain(forbiddenSecretLogging);

    expect(appSource).toContain("createRenderWorkerLifecycle(");
    expect(appSource).toContain("app.use(createExportRouter(");
    expect(appSource).not.toContain("SupabaseExportJobRegistry");

    expect(renderWorkerSource).toContain(
      'FREE_AI_MIXER_ENABLE_WORKER_LOOP === "1"',
    );
    expect(renderWorkerSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerSource).not.toContain(forbiddenSecretLogging);
  });
});
