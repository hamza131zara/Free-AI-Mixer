import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  BackendArtifactMetadata,
  BackendExportJobOwnerScope,
  BackendExportJobRecord,
} from "../../backend/contracts/exportHttpTypes";
import { createBackendDependencies } from "../../backend/composition/backendDependencies";
import type {
  CreateExportJobInput,
  ExportJobClaimOptions,
  ExportJobRegistry,
  ExportJobTransitionOptions,
} from "../../backend/registry/exportJobRegistry";
import {
  drainRenderWorkerOnce,
  type RenderWorkerDrainResult,
} from "../../backend/workers/renderWorker";
import type {
  RendererAdapterInput,
  RendererAdapterResult,
} from "../../backend/renderer/singleProcessRenderHarness";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase70-supabase-worker-manual-drain-boundary.spec.ts",
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
const renderWorkerStartupPath = path.join(
  process.cwd(),
  "backend",
  "workers",
  "renderWorkerStartup.ts",
);
const harnessPath = path.join(
  process.cwd(),
  "backend",
  "renderer",
  "singleProcessRenderHarness.ts",
);

const ENV_KEYS = [
  "FREE_AI_MIXER_ENABLE_WORKER_STARTUP",
  "FREE_AI_MIXER_ENABLE_WORKER_LOOP",
  "FREE_AI_MIXER_ENABLE_SUPABASE_DB",
  "FREE_AI_MIXER_DB_PROVIDER",
  "FREE_AI_MIXER_SUPABASE_URL",
  "FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
  "FREE_AI_MIXER_SUPABASE_ANON_KEY",
  "FREE_AI_MIXER_DATABASE_URL",
  "FREE_AI_MIXER_PERSISTENCE_ENABLED",
  "FREE_AI_MIXER_PERSISTENCE_FILE_PATH",
  "FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM",
  "FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION",
  "FREE_AI_MIXER_WORKER_POLL_INTERVAL_MS",
] as const;

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
  fs.mkdtemp(path.join(os.tmpdir(), "phase70-worker-"));

const cleanupTempRoot = async (rootPath: string): Promise<void> => {
  await fs.rm(rootPath, { recursive: true, force: true });
};

const createRecord = (
  overrides: Partial<BackendExportJobRecord> = {},
): BackendExportJobRecord => ({
  jobId: "job-phase70-default",
  requestId: "request-phase70-default",
  timelineId: "timeline-phase70-default",
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

class TrackingManualDrainRegistry implements ExportJobRegistry {
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
    throw new Error("create should not be called in phase70 manual drain boundary");
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
    throw new Error(
      "getByRequestId should not be called in phase70 manual drain boundary",
    );
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
    throw new Error("transition should not be called in phase70 manual drain boundary");
  }
}

const createWorkerAdapter = async (
  input: RendererAdapterInput,
): Promise<RendererAdapterResult> => {
  await fs.mkdir(input.resolvedOutputPath.directoryPath, { recursive: true });
  await fs.writeFile(
    input.resolvedOutputPath.filePath,
    Buffer.from("phase70-video-bytes"),
  );
  return { ok: true };
};

test.describe("phase70 supabase worker manual drain boundary", () => {
  test("manual drain composes directly with injected runtime dependencies without requiring worker startup or loop activation", async () => {
    await withEnv(
      {
        FREE_AI_MIXER_ENABLE_SUPABASE_DB: "1",
        FREE_AI_MIXER_DB_PROVIDER: "supabase",
        FREE_AI_MIXER_SUPABASE_URL: "https://example.supabase.co",
        FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
      },
      async () => {
        const tempRoot = await createTempRoot();
        const previousCwd = process.cwd();
        process.chdir(tempRoot);

        try {
          const backendDependencies = createBackendDependencies();
          const registry = new TrackingManualDrainRegistry([
            createRecord({
              jobId: "job-phase70-success",
              requestId: "request-phase70-success",
            }),
          ]);

          expect(backendDependencies.repositoryComposition.kind).toBe(
            "repository_composition_available",
          );
          expect(backendDependencies.registry.constructor.name).toBe(
            "SupabaseExportJobRegistry",
          );

          const result: RenderWorkerDrainResult = await drainRenderWorkerOnce(
            registry,
            createWorkerAdapter,
            backendDependencies.pathPolicy,
            {
              workerId: "worker-phase70-manual",
              onVerifiedArtifactRef: backendDependencies.onVerifiedArtifactRef,
            },
          );

          expect(result.workerId).toBe("worker-phase70-manual");
          expect(result.attemptedJobIds).toEqual(["job-phase70-success"]);
          expect(result.acceptedCount).toBe(1);
          expect(result.failedCount).toBe(0);
          expect(result.skippedCount).toBe(0);
          expect(result.errors).toEqual([]);

          expect(registry.getByStatusCalls).toEqual(["submitted"]);
          expect(registry.transitionCalls).toBe(0);
          expect(registry.lifecycleCalls).toEqual([
            "claim:job-phase70-success",
            "markRendering:job-phase70-success",
            "markFinalizing:job-phase70-success",
            "markSuccess:job-phase70-success",
          ]);

          const storedArtifact = backendDependencies.artifactStorageRefResolver.resolve(
            "job-phase70-success",
            "job-phase70-success_artifact",
          );

          const successRecord = await registry.getById("job-phase70-success");
          expect(successRecord?.status).toBe("success");
          expect(successRecord?.artifacts).toHaveLength(1);
          expect(storedArtifact).toBeUndefined();
        } finally {
          process.chdir(previousCwd);
          await cleanupTempRoot(tempRoot);
        }
      },
    );
  });

  test("source keeps manual drain separate from startup/loop gating and Supabase registry selection, with no CLI, secret logging, signed-url behavior, or remote requirements", async () => {
    const [
      specSource,
      backendDependenciesSource,
      renderWorkerSource,
      renderWorkerStartupSource,
      harnessSource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(backendDependenciesPath),
      readFileSource(renderWorkerPath),
      readFileSource(renderWorkerStartupPath),
      readFileSource(harnessPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");

    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(renderWorkerSource).toContain("export const drainRenderWorkerOnce = async");
    expect(renderWorkerSource).toContain('await registry.getByStatus("submitted")');
    expect(renderWorkerSource).toContain("await executeRenderJob({");
    expect(renderWorkerSource).not.toContain("registry.transition(");
    expect(renderWorkerSource).not.toContain("FREE_AI_MIXER_ENABLE_WORKER_STARTUP");
    expect(renderWorkerSource).not.toContain("signedUrl");
    expect(renderWorkerSource).not.toContain("downloadUrl");
    expect(renderWorkerSource).not.toContain("storage_refs");
    expect(renderWorkerSource).not.toContain(forbiddenSecretLogging);

    expect(renderWorkerStartupSource).toContain(
      'FREE_AI_MIXER_ENABLE_WORKER_STARTUP === "1"',
    );
    expect(renderWorkerStartupSource).toContain("loopController.start()");
    expect(renderWorkerStartupSource).not.toContain("drainRenderWorkerOnce(");

    expect(backendDependenciesSource).toContain(
      'repositoryComposition.kind === "repository_composition_available"',
    );
    expect(backendDependenciesSource).toContain("new SupabaseExportJobRegistry");
    expect(backendDependenciesSource).not.toContain(
      "FREE_AI_MIXER_ENABLE_WORKER_STARTUP",
    );
    expect(backendDependenciesSource).not.toContain(
      "FREE_AI_MIXER_ENABLE_WORKER_LOOP",
    );

    expect(harnessSource).toContain("await input.registry.claim");
    expect(harnessSource).toContain("await input.registry.markRendering");
    expect(harnessSource).toContain("await input.registry.markFinalizing");
    expect(harnessSource).toContain("await input.registry.markSuccess");
    expect(harnessSource).toContain("await input.registry.markError");
    expect(harnessSource).not.toContain("input.registry.transition(");
  });
});
