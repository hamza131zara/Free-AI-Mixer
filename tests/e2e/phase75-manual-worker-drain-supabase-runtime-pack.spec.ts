import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readSupabaseConfigFromEnv } from "../../backend/config/supabaseConfig";
import { createSupabaseClientFactory } from "../../backend/db/supabaseClientFactory";
import {
  createBackendDependencies,
  drainBackendWorkerOnce,
  type BackendDependencies,
} from "../../backend/composition/backendDependencies";
import type {
  BackendArtifactMetadata,
  BackendExportJobOwnerScope,
  BackendExportJobRecord,
} from "../../backend/contracts/exportHttpTypes";
import type {
  CreateExportJobInput,
  ExportJobClaimOptions,
  ExportJobRegistry,
  ExportJobTransitionOptions,
} from "../../backend/registry/exportJobRegistry";
import type {
  RendererAdapterInput,
  RendererAdapterResult,
} from "../../backend/renderer/singleProcessRenderHarness";

const OPT_IN_ENV = "FREE_AI_MIXER_RUN_REMOTE_SUPABASE_WORKER_DRAIN_SMOKE";
const REQUIRED_REMOTE_ENV_KEYS = [
  "FREE_AI_MIXER_ENABLE_SUPABASE_DB",
  "FREE_AI_MIXER_DB_PROVIDER",
  "FREE_AI_MIXER_SUPABASE_URL",
  "FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
] as const;

const ENV_KEYS = [
  "FREE_AI_MIXER_ENABLE_SUPABASE_DB",
  "FREE_AI_MIXER_DB_PROVIDER",
  "FREE_AI_MIXER_SUPABASE_URL",
  "FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
  "FREE_AI_MIXER_SUPABASE_ANON_KEY",
  "FREE_AI_MIXER_DATABASE_URL",
  "FREE_AI_MIXER_PERSISTENCE_ENABLED",
  "FREE_AI_MIXER_PERSISTENCE_FILE_PATH",
  "FREE_AI_MIXER_ENABLE_WORKER_STARTUP",
  "FREE_AI_MIXER_ENABLE_WORKER_LOOP",
  "FREE_AI_MIXER_WORKER_POLL_INTERVAL_MS",
  "FREE_AI_MIXER_RUN_REMOTE_SUPABASE_WORKER_DRAIN_SMOKE",
  "FREE_AI_MIXER_RUN_REMOTE_SUPABASE_LIFECYCLE_SMOKE",
  "FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION",
] as const;

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase75-manual-worker-drain-supabase-runtime-pack.spec.ts",
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
const renderWorkerLifecyclePath = path.join(
  process.cwd(),
  "backend",
  "workers",
  "renderWorkerLifecycle.ts",
);
const routesPath = path.join(process.cwd(), "backend", "routes", "exports.ts");
const phase74SpecPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase74-supabase-remote-lifecycle-smoke-pack.spec.ts",
);

const defaultOwnerScope: BackendExportJobOwnerScope = {
  ownerId: "local-dev-owner",
  workspaceId: "local-dev-workspace",
};

const readFileSource = async (filePath: string): Promise<string> =>
  fs.readFile(filePath, "utf8");

const withEnv = async (
  values: Partial<Record<(typeof ENV_KEYS)[number], string>>,
  run: () => Promise<void>,
): Promise<void> => {
  const previous = new Map<string, string | undefined>();

  for (const key of ENV_KEYS) {
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
    for (const key of ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

const getMissingRequiredEnvKeys = (): string[] =>
  REQUIRED_REMOTE_ENV_KEYS.filter((key) => {
    const value = process.env[key];
    return typeof value !== "string" || value.trim().length === 0;
  });

const sanitizeSupabaseErrorMessage = (error: unknown): string => {
  const secret = process.env.FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY ?? "";
  const projectUrl = process.env.FREE_AI_MIXER_SUPABASE_URL ?? "";

  if (error instanceof Error) {
    return error.message
      .replaceAll(secret, "[redacted]")
      .replaceAll(projectUrl, "[redacted]");
  }

  return "Unknown remote Supabase worker drain smoke failure.";
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

const buildPattern = (...parts: string[]): string => parts.join("");

const createTempRoot = async (): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), "phase75-worker-"));

const cleanupTempRoot = async (rootPath: string): Promise<void> => {
  await fs.rm(rootPath, { recursive: true, force: true });
};

const createRecord = (
  overrides: Partial<BackendExportJobRecord> = {},
): BackendExportJobRecord => ({
  jobId: "job-phase75-default",
  requestId: "request-phase75-default",
  timelineId: "timeline-phase75-default",
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

class TrackingSupabaseRuntimeDrainRegistry implements ExportJobRegistry {
  private readonly records = new Map<string, BackendExportJobRecord>();

  public readonly getByStatusCalls: string[] = [];
  public readonly lifecycleCalls: string[] = [];
  public transitionCalls = 0;

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
    throw new Error("create should not be called in phase75 offline smoke");
  }

  async getById(jobId: string): Promise<BackendExportJobRecord | undefined> {
    const record = this.records.get(jobId);
    return record ? { ...record } : undefined;
  }

  async getByIdForOwner(
    jobId: string,
    ownerScope: BackendExportJobOwnerScope,
  ): Promise<BackendExportJobRecord | undefined> {
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
    throw new Error("getByRequestId should not be called in phase75 offline smoke");
  }

  async getByStatus(status: string): Promise<BackendExportJobRecord[]> {
    this.getByStatusCalls.push(status);
    return Array.from(this.records.values()).map((record) => ({ ...record }));
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
    throw new Error("transition should not be called in phase75 offline smoke");
  }
}

const createWorkerAdapter = async (
  input: RendererAdapterInput,
): Promise<RendererAdapterResult> => {
  await fs.mkdir(input.resolvedOutputPath.directoryPath, { recursive: true });
  await fs.writeFile(
    input.resolvedOutputPath.filePath,
    Buffer.from("phase75-video-bytes"),
  );
  return { ok: true };
};

test.describe("phase75 manual worker drain supabase runtime pack", () => {
  test("default runs stay offline while manual drain composes cleanly with env-gated Supabase runtime selection and no loop activation", async () => {
    await withEnv(
      {
        FREE_AI_MIXER_ENABLE_SUPABASE_DB: "1",
        FREE_AI_MIXER_DB_PROVIDER: "supabase",
        FREE_AI_MIXER_SUPABASE_URL: "https://example.supabase.co",
        FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY: "phase75-service-role-test-key",
        FREE_AI_MIXER_ENABLE_WORKER_STARTUP: "0",
        FREE_AI_MIXER_ENABLE_WORKER_LOOP: "0",
      },
      async () => {
        const tempRoot = await createTempRoot();
        const previousCwd = process.cwd();
        process.chdir(tempRoot);

        try {
          const runtimeDeps = createBackendDependencies();
          const trackingRegistry = new TrackingSupabaseRuntimeDrainRegistry([
            createRecord({
              jobId: "job-phase75-success",
              requestId: "request-phase75-success",
            }),
          ]);

          const manualDeps: BackendDependencies = {
            ...runtimeDeps,
            registry: trackingRegistry,
            rendererAdapter: createWorkerAdapter,
          };
          const signedUrlField = buildPattern("signed", "Url");
          const downloadUrlField = buildPattern("download", "Url");
          const storageRefField = buildPattern("storage", "Ref");

          expect(runtimeDeps.repositoryComposition.kind).toBe(
            "repository_composition_available",
          );
          expect(runtimeDeps.registry.constructor.name).toBe(
            "SupabaseExportJobRegistry",
          );

          const result = await drainBackendWorkerOnce(manualDeps, {
            workerId: "worker-phase75-manual",
          });

          expect(result.workerId).toBe("worker-phase75-manual");
          expect(result.attemptedJobIds).toEqual(["job-phase75-success"]);
          expect(result.acceptedCount).toBe(1);
          expect(result.failedCount).toBe(0);
          expect(result.skippedCount).toBe(0);
          expect(result.errors).toEqual([]);

          expect(trackingRegistry.getByStatusCalls).toEqual(["submitted"]);
          expect(trackingRegistry.transitionCalls).toBe(0);
          expect(trackingRegistry.lifecycleCalls).toEqual([
            "claim:job-phase75-success",
            "markRendering:job-phase75-success",
            "markFinalizing:job-phase75-success",
            "markSuccess:job-phase75-success",
          ]);

          const successRecord = await trackingRegistry.getById("job-phase75-success");
          expect(successRecord?.status).toBe("success");
          expect(successRecord?.artifacts).toHaveLength(1);
          expect(successRecord?.artifacts?.[0]).not.toHaveProperty(signedUrlField);
          expect(successRecord?.artifacts?.[0]).not.toHaveProperty(downloadUrlField);
          expect(successRecord?.artifacts?.[0]).not.toHaveProperty(storageRefField);
        } finally {
          process.chdir(previousCwd);
          await cleanupTempRoot(tempRoot);
        }
      },
    );
  });

  test("source keeps manual worker drain separate from startup, loop, routes, CLI, secret logging, and signed/download/storage URL behavior", async () => {
    const [
      specSource,
      backendDependenciesSource,
      renderWorkerSource,
      renderWorkerLifecycleSource,
      routesSource,
      phase74SpecSource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(backendDependenciesPath),
      readFileSource(renderWorkerPath),
      readFileSource(renderWorkerLifecyclePath),
      readFileSource(routesPath),
      readFileSource(phase74SpecPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");
    const forbiddenSignedUrlField = buildPattern("signed", "Url");
    const forbiddenDownloadUrlField = buildPattern("download", "Url");
    const forbiddenStorageRefsField = buildPattern("storage", "_refs");
    const forbiddenWorkerLoopEnv = buildPattern(
      "FREE_AI_MIXER_ENABLE_WORKER",
      "_LOOP",
    );
    const forbiddenStartupEnv = buildPattern(
      "FREE_AI_MIXER_ENABLE_WORKER",
      "_STARTUP",
    );
    const remoteDrainEnv = buildPattern(
      "FREE_AI_MIXER_RUN_REMOTE_SUPABASE_WORKER",
      "_DRAIN_SMOKE",
    );

    expect(specSource).toContain(
      'const OPT_IN_ENV = "FREE_AI_MIXER_RUN_REMOTE_SUPABASE_WORKER_DRAIN_SMOKE"',
    );
    expect(specSource).toContain("test.skip(");
    expect(specSource).toContain("drainBackendWorkerOnce(");
    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(backendDependenciesSource).toContain(
      "export const drainBackendWorkerOnce = async",
    );
    expect(backendDependenciesSource).toContain(
      'repositoryComposition.kind === "repository_composition_available"',
    );
    expect(backendDependenciesSource).not.toContain(remoteDrainEnv);
    expect(backendDependenciesSource).not.toContain(forbiddenStartupEnv);
    expect(backendDependenciesSource).not.toContain(forbiddenWorkerLoopEnv);

    expect(renderWorkerSource).toContain('await registry.getByStatus("submitted")');
    expect(renderWorkerSource).toContain("await executeRenderJob({");
    expect(renderWorkerSource).not.toContain("registry.transition(");
    expect(renderWorkerSource).toContain(
      'FREE_AI_MIXER_ENABLE_WORKER_LOOP === "1"',
    );
    expect(renderWorkerSource).not.toContain(forbiddenSignedUrlField);
    expect(renderWorkerSource).not.toContain(forbiddenDownloadUrlField);
    expect(renderWorkerSource).not.toContain(forbiddenStorageRefsField);

    expect(renderWorkerLifecycleSource).toContain("startupController.start()");
    expect(routesSource).not.toContain("drainBackendWorkerOnce(");
    expect(routesSource).not.toContain(forbiddenSignedUrlField);
    expect(routesSource).not.toContain(forbiddenDownloadUrlField);
    expect(routesSource).not.toContain(forbiddenStorageRefsField);
    expect(phase74SpecSource).toContain(
      'const OPT_IN_ENV = "FREE_AI_MIXER_RUN_REMOTE_SUPABASE_LIFECYCLE_SMOKE"',
    );
  });

  test("remote manual worker drain smoke stays opt-in and runs only with complete backend Supabase env", async () => {
    test.skip(
      process.env[OPT_IN_ENV] !== "1",
      `Set ${OPT_IN_ENV}=1 to run the remote Supabase worker drain smoke test.`,
    );

    const missingEnvKeys = getMissingRequiredEnvKeys();
    expect(
      missingEnvKeys,
      `Remote Supabase worker drain smoke is opt-in and requires env vars: ${missingEnvKeys.join(", ")}`,
    ).toEqual([]);

    const config = readSupabaseConfigFromEnv(process.env);
    expect(config.enabled).toBe(true);
    expect(config.valid).toBe(true);

    const clientFactoryResult = createSupabaseClientFactory(config);
    expect(clientFactoryResult.kind).toBe("supabase_client_factory");

    if (clientFactoryResult.kind !== "supabase_client_factory") {
      throw new Error(
        "Remote Supabase worker drain smoke requires a valid backend-only client factory.",
      );
    }

    const tempRoot = await createTempRoot();
    const previousCwd = process.cwd();
    process.chdir(tempRoot);

    try {
      const dependencies = createBackendDependencies();
      const registry = dependencies.registry;
      const adminHandle = clientFactoryResult.createAdminClientHandle();
      const runId = `phase75_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const ownerId = `phase75-owner-${runId}`;
      const workspaceId = `phase75-workspace-${runId}`;
      const requestId = `phase75-request-${runId}`;
      const timelineId = `phase75-timeline-${runId}`;
      const workerId = `phase75-worker-${runId}`;

      const drainDeps: BackendDependencies = {
        ...dependencies,
        rendererAdapter: createWorkerAdapter,
      };

      const created = await registry.create({
        requestId,
        timelineId,
        ownerId,
        workspaceId,
        renderSettings: {
          format: "mp4",
          resolution: "720p",
          fps: 24,
          quality: "draft",
        },
      });

      const drainResult = await drainBackendWorkerOnce(drainDeps, { workerId });
      const readBack = await registry.getById(created.jobId);
      const artifactRows = await adminHandle.client
        .from("artifact_records")
        .select(
          "artifact_id, job_id, kind, format, status, size_bytes, duration_ms, created_at",
        )
        .eq("job_id", created.jobId)
        .limit(1);

      expect(drainResult.acceptedCount).toBeGreaterThanOrEqual(1);
      expect(drainResult.attemptedJobIds).toContain(created.jobId);
      expect(drainResult.failedCount).toBe(0);
      expect(drainResult.errors).toEqual([]);
      expect(readBack?.status).toBe("success");
      expect(artifactRows.error).toBeNull();
      expect(Array.isArray(artifactRows.data)).toBe(true);
      expect(artifactRows.data?.length).toBeGreaterThan(0);
      expect(JSON.stringify(artifactRows.data)).not.toContain(
        buildPattern("signed", "Url"),
      );
      expect(JSON.stringify(artifactRows.data)).not.toContain(
        buildPattern("download", "Url"),
      );
      expect(JSON.stringify(artifactRows.data)).not.toContain(
        buildPattern("storage", "Ref"),
      );
    } catch (error) {
      throw new Error(
        `Remote Supabase worker drain smoke failed: ${sanitizeSupabaseErrorMessage(error)}`,
      );
    } finally {
      process.chdir(previousCwd);
      await cleanupTempRoot(tempRoot);
    }
  });
});
