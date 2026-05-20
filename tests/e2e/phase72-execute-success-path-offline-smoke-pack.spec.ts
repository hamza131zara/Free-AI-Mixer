import { expect, test } from "@playwright/test";
import express from "express";
import { promises as fs } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { exportErrorHandler } from "../../backend/errors/exportErrors";
import type {
  BackendArtifactMetadata,
  BackendExportJobOwnerScope,
  BackendExportJobRecord,
} from "../../backend/contracts/exportHttpTypes";
import { createExportRouter } from "../../backend/routes/exports";
import type {
  CreateExportJobInput,
  ExportJobClaimOptions,
  ExportJobRegistry,
  ExportJobTransitionOptions,
} from "../../backend/registry/exportJobRegistry";
import type {
  RendererAdapter,
  RendererAdapterInput,
  RendererAdapterResult,
  VerifiedArtifactRefPayload,
} from "../../backend/renderer/singleProcessRenderHarness";
import type { RenderOutputPathPolicy } from "../../backend/renderer/outputPathPolicy";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase72-execute-success-path-offline-smoke-pack.spec.ts",
);
const routesPath = path.join(process.cwd(), "backend", "routes", "exports.ts");
const harnessPath = path.join(
  process.cwd(),
  "backend",
  "renderer",
  "singleProcessRenderHarness.ts",
);
const backendDependenciesPath = path.join(
  process.cwd(),
  "backend",
  "composition",
  "backendDependencies.ts",
);
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

const createTempRoot = async (): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), "phase72-execute-"));

const cleanupTempRoot = async (rootPath: string): Promise<void> => {
  await fs.rm(rootPath, { recursive: true, force: true });
};

const createRecord = (
  overrides: Partial<BackendExportJobRecord> = {},
): BackendExportJobRecord => ({
  jobId: "job-phase72-default",
  requestId: "request-phase72-default",
  timelineId: "timeline-phase72-default",
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

class TrackingExecuteRegistry implements ExportJobRegistry {
  private readonly records = new Map<string, BackendExportJobRecord>();

  public readonly ownerReads: string[] = [];
  public readonly lifecycleCalls: string[] = [];
  public transitionCalls = 0;
  public getByStatusCalls: string[] = [];

  constructor(initialRecords: BackendExportJobRecord[]) {
    for (const record of initialRecords) {
      this.records.set(record.jobId, { ...record });
    }
  }

  private getRecord(jobId: string): BackendExportJobRecord {
    const record = this.records.get(jobId);
    if (!record) {
      throw new Error(`Missing record for ${jobId}`);
    }
    return record;
  }

  async create(_input: CreateExportJobInput): Promise<BackendExportJobRecord> {
    throw new Error("create should not be called in phase72 execute success smoke");
  }

  async getById(jobId: string): Promise<BackendExportJobRecord | undefined> {
    const record = this.records.get(jobId);
    return record ? { ...record } : undefined;
  }

  async getByIdForOwner(
    jobId: string,
    ownerScope: BackendExportJobOwnerScope,
  ): Promise<BackendExportJobRecord | undefined> {
    this.ownerReads.push(jobId);
    const record = this.records.get(jobId);
    if (!record) {
      return undefined;
    }
    return record.ownerId === ownerScope.ownerId &&
        record.workspaceId === ownerScope.workspaceId
      ? { ...record }
      : undefined;
  }

  async getByRequestId(): Promise<BackendExportJobRecord | undefined> {
    throw new Error("getByRequestId should not be called in phase72 execute success smoke");
  }

  async getByStatus(status: string): Promise<BackendExportJobRecord[]> {
    this.getByStatusCalls.push(status);
    return [];
  }

  async claim(
    jobId: string,
    workerId: string,
    _options?: ExportJobClaimOptions,
  ): Promise<BackendExportJobRecord> {
    this.lifecycleCalls.push(`claim:${jobId}`);
    const record = this.getRecord(jobId);
    record.claimedByWorkerId = workerId;
    record.attemptCount += 1;
    record.updatedAt = "2026-05-20T12:10:00.000Z";
    return { ...record };
  }

  async markRendering(
    jobId: string,
    workerId: string,
  ): Promise<BackendExportJobRecord> {
    this.lifecycleCalls.push(`markRendering:${jobId}`);
    const record = this.getRecord(jobId);
    record.claimedByWorkerId = workerId;
    record.status = "rendering";
    record.updatedAt = "2026-05-20T12:11:00.000Z";
    return { ...record };
  }

  async markFinalizing(
    jobId: string,
    workerId: string,
  ): Promise<BackendExportJobRecord> {
    this.lifecycleCalls.push(`markFinalizing:${jobId}`);
    const record = this.getRecord(jobId);
    record.claimedByWorkerId = workerId;
    record.status = "finalizing";
    record.updatedAt = "2026-05-20T12:12:00.000Z";
    return { ...record };
  }

  async markSuccess(
    jobId: string,
    workerId: string,
    artifacts: unknown[],
  ): Promise<BackendExportJobRecord> {
    this.lifecycleCalls.push(`markSuccess:${jobId}`);
    const record = this.getRecord(jobId);
    record.claimedByWorkerId = workerId;
    record.status = "success";
    record.completedAt = "2026-05-20T12:13:00.000Z";
    record.updatedAt = "2026-05-20T12:13:00.000Z";
    record.artifacts = artifacts as BackendArtifactMetadata[];
    return { ...record };
  }

  async markError(
    jobId: string,
    workerId: string,
    failure: { message: string; code?: string; details?: unknown },
  ): Promise<BackendExportJobRecord> {
    this.lifecycleCalls.push(`markError:${jobId}`);
    const record = this.getRecord(jobId);
    record.claimedByWorkerId = workerId;
    record.status = "error";
    record.failure = failure;
    record.updatedAt = "2026-05-20T12:13:30.000Z";
    return { ...record };
  }

  async transition(
    _jobId: string,
    _nextStatus: BackendExportJobRecord["status"],
    _options?: ExportJobTransitionOptions,
  ): Promise<BackendExportJobRecord> {
    this.transitionCalls += 1;
    throw new Error("transition should not be called in phase72 execute success smoke");
  }
}

const startServer = async (
  registry: ExportJobRegistry,
  options: {
    rendererAdapter: RendererAdapter;
    pathPolicy: RenderOutputPathPolicy;
    onVerifiedArtifactRef?: (payload: VerifiedArtifactRefPayload) => void;
  },
): Promise<{ baseUrl: string; close: () => Promise<void> }> => {
  const app = express();
  app.use(express.json());
  app.use(
    createExportRouter(registry, {
      rendererAdapter: options.rendererAdapter,
      pathPolicy: options.pathPolicy,
      onVerifiedArtifactRef: options.onVerifiedArtifactRef,
    }),
  );
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

test.describe("phase72 execute success-path offline smoke pack", () => {
  test("execute route success path stays offline, uses claim/render/finalize/success order, and returns truthful verified artifact metadata without URLs", async () => {
    const tempRoot = await createTempRoot();
    const writtenBytes = Buffer.from("phase72-rendered-mp4");
    const capturedRefs: VerifiedArtifactRefPayload[] = [];
    const registry = new TrackingExecuteRegistry([
      createRecord({
        jobId: "job-phase72-execute",
        requestId: "request-phase72-execute",
        timelineId: "timeline-phase72-execute",
      }),
    ]);
    const pathPolicy: RenderOutputPathPolicy = {
      roots: {
        temp: path.join(tempRoot, "temp"),
        output: path.join(tempRoot, "output"),
      },
    };
    const rendererAdapter: RendererAdapter = async (
      input: RendererAdapterInput,
    ): Promise<RendererAdapterResult> => {
      await fs.mkdir(input.resolvedOutputPath.directoryPath, { recursive: true });
      await fs.writeFile(input.resolvedOutputPath.filePath, writtenBytes);
      return { ok: true };
    };

    const server = await startServer(registry, {
      rendererAdapter,
      pathPolicy,
      onVerifiedArtifactRef: (payload) => {
        capturedRefs.push(payload);
      },
    });

    try {
      await withEnv(
        {
          FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION: "1",
          FREE_AI_MIXER_ROUTE_EXECUTION_TIMEOUT_MS: "5000",
        },
        async () => {
          const executeResponse = await fetch(
            `${server.baseUrl}/exports/job-phase72-execute/execute`,
            { method: "POST" },
          );

          expect(executeResponse.status).toBe(200);
          const executeBody = await executeResponse.json();
          expect(executeBody).toMatchObject({
            kind: "executed",
            jobId: "job-phase72-execute",
            status: "success",
            artifact: {
              jobId: "job-phase72-execute",
              kind: "render_output",
              format: "mp4",
              status: "available",
              sizeBytes: writtenBytes.length,
            },
          });
          expect(executeBody.artifact.artifactId).toMatch(
            /^job-phase72-execute_/,
          );
          expect(typeof executeBody.artifact.createdAt).toBe("string");
          expect(executeBody.artifact).not.toHaveProperty("downloadUrl");
          expect(executeBody.artifact).not.toHaveProperty("signedUrl");
          expect(executeBody.artifact).not.toHaveProperty("streamUrl");
          expect(executeBody.artifact).not.toHaveProperty("storageRef");
        },
      );

      expect(registry.lifecycleCalls).toEqual([
        "claim:job-phase72-execute",
        "markRendering:job-phase72-execute",
        "markFinalizing:job-phase72-execute",
        "markSuccess:job-phase72-execute",
      ]);
      expect(registry.transitionCalls).toBe(0);
      expect(registry.getByStatusCalls).toEqual([]);

      const storedRecord = await registry.getById("job-phase72-execute");
      expect(storedRecord?.status).toBe("success");
      expect(storedRecord?.artifacts).toHaveLength(1);
      expect(storedRecord?.artifacts?.[0]).toMatchObject({
        jobId: "job-phase72-execute",
        kind: "render_output",
        format: "mp4",
        status: "available",
        sizeBytes: writtenBytes.length,
      });
      expect(storedRecord?.artifacts?.[0]).not.toHaveProperty("downloadUrl");
      expect(storedRecord?.artifacts?.[0]).not.toHaveProperty("signedUrl");
      expect(storedRecord?.artifacts?.[0]).not.toHaveProperty("streamUrl");
      expect(storedRecord?.artifacts?.[0]).not.toHaveProperty("storageRef");

      expect(capturedRefs).toHaveLength(1);
      expect(capturedRefs[0]?.artifact).toMatchObject({
        jobId: "job-phase72-execute",
        kind: "render_output",
        format: "mp4",
        status: "available",
        sizeBytes: writtenBytes.length,
      });
      expect(capturedRefs[0]?.storageRef.filePath.endsWith(".mp4")).toBe(true);
      expect(capturedRefs[0]?.storageRef.rootPath).toBe(pathPolicy.roots.output);

      const pollResponse = await fetch(
        `${server.baseUrl}/exports/job-phase72-execute`,
      );
      expect(pollResponse.status).toBe(200);
      await expect(pollResponse.json()).resolves.toEqual({
        kind: "terminal_success",
        result: {
          provider: "backend_render",
          requestId: "request-phase72-execute",
          jobId: "job-phase72-execute",
          artifacts: [
            {
              id: storedRecord?.artifacts?.[0]?.artifactId,
              status: "ready",
              bytes: writtenBytes.length,
            },
          ],
          completedAt: "2026-05-20T12:13:00.000Z",
        },
      });
      expect(registry.ownerReads).toEqual([
        "job-phase72-execute",
        "job-phase72-execute",
      ]);
    } finally {
      await server.close();
      await cleanupTempRoot(tempRoot);
    }
  });

  test("source keeps execute success smoke offline with no CLI, secret logging, signed/download/storage URL behavior, generic transition use, or worker loop startup", async () => {
    const [
      specSource,
      routesSource,
      harnessSource,
      backendDependenciesSource,
      renderWorkerSource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(routesPath),
      readFileSource(harnessPath),
      readFileSource(backendDependenciesPath),
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

    expect(routesSource).toContain("executeRenderJob({");
    expect(routesSource).toContain(
      'process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION === "1"',
    );
    expect(routesSource).not.toContain("registry.transition(");
    expect(routesSource).not.toContain("signedUrl");
    expect(routesSource).not.toContain("downloadUrl");
    expect(routesSource).not.toContain("storage_refs");
    expect(routesSource).not.toContain(forbiddenSecretLogging);

    expect(harnessSource).toContain("await input.registry.claim");
    expect(harnessSource).toContain("await input.registry.markRendering");
    expect(harnessSource).toContain("await input.registry.markFinalizing");
    expect(harnessSource).toContain("await input.registry.markSuccess");
    expect(harnessSource).toContain("await input.registry.markError");
    expect(harnessSource).not.toContain("input.registry.transition(");
    expect(harnessSource).not.toContain("signedUrl");
    expect(harnessSource).not.toContain("downloadUrl");
    expect(harnessSource).not.toContain("storage_refs");

    expect(backendDependenciesSource).toContain(
      "export const drainBackendWorkerOnce = async",
    );
    expect(renderWorkerSource).toContain(
      'FREE_AI_MIXER_ENABLE_WORKER_LOOP === "1"',
    );
  });
});
