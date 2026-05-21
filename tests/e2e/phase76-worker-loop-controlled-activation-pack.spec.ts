import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRenderWorkerLoop } from "../../backend/workers/renderWorker";
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

const ENV_KEYS = [
  "FREE_AI_MIXER_ENABLE_WORKER_STARTUP",
  "FREE_AI_MIXER_ENABLE_WORKER_LOOP",
  "FREE_AI_MIXER_WORKER_POLL_INTERVAL_MS",
  "FREE_AI_MIXER_ENABLE_SUPABASE_DB",
  "FREE_AI_MIXER_DB_PROVIDER",
  "FREE_AI_MIXER_SUPABASE_URL",
  "FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
  "FREE_AI_MIXER_SUPABASE_ANON_KEY",
  "FREE_AI_MIXER_DATABASE_URL",
  "FREE_AI_MIXER_PERSISTENCE_ENABLED",
  "FREE_AI_MIXER_PERSISTENCE_FILE_PATH",
  "FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION",
  "FREE_AI_MIXER_RUN_REMOTE_SUPABASE_WORKER_DRAIN_SMOKE",
] as const;

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase76-worker-loop-controlled-activation-pack.spec.ts",
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
const renderWorkerLifecyclePath = path.join(
  process.cwd(),
  "backend",
  "workers",
  "renderWorkerLifecycle.ts",
);
const backendDependenciesPath = path.join(
  process.cwd(),
  "backend",
  "composition",
  "backendDependencies.ts",
);
const appPath = path.join(process.cwd(), "backend", "app.ts");
const serverPath = path.join(process.cwd(), "backend", "server.ts");

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

const buildPattern = (...parts: string[]): string => parts.join("");

const createTempRoot = async (): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), "phase76-worker-loop-"));

const cleanupTempRoot = async (rootPath: string): Promise<void> => {
  await fs.rm(rootPath, { recursive: true, force: true });
};

const createRecord = (
  overrides: Partial<BackendExportJobRecord> = {},
): BackendExportJobRecord => ({
  jobId: "job-phase76-loop",
  requestId: "request-phase76-loop",
  timelineId: "timeline-phase76-loop",
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

class TrackingLoopRegistry implements ExportJobRegistry {
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
    throw new Error("create should not be called in phase76 loop smoke");
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
    throw new Error("getByRequestId should not be called in phase76 loop smoke");
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
    throw new Error("transition should not be called in phase76 loop smoke");
  }
}

const createLoopAdapter = async (
  input: RendererAdapterInput,
): Promise<RendererAdapterResult> => {
  await fs.mkdir(input.resolvedOutputPath.directoryPath, { recursive: true });
  await fs.writeFile(
    input.resolvedOutputPath.filePath,
    Buffer.from("phase76-video-bytes"),
  );
  return { ok: true };
};

test.describe("phase76 worker loop controlled activation pack", () => {
  test("worker loop remains inert unless loop env is enabled, can run offline with fake dependencies, and stops cleanly", async () => {
    await withEnv({}, async () => {
      const registry = new TrackingLoopRegistry([createRecord()]);
      const inertLoop = createRenderWorkerLoop(
        registry,
        createLoopAdapter,
        {
          roots: {
            temp: process.cwd(),
            output: process.cwd(),
          },
        },
        { workerId: "worker-phase76-inert", pollIntervalMs: 25 },
      );

      expect(inertLoop.getStatus().enabledByEnv).toBe(false);
      expect(inertLoop.getStatus().running).toBe(false);

      inertLoop.start();

      expect(inertLoop.isRunning()).toBe(false);
      expect(registry.getByStatusCalls).toEqual([]);
      inertLoop.stop();
    });

    await withEnv(
      {
        FREE_AI_MIXER_ENABLE_WORKER_STARTUP: "1",
        FREE_AI_MIXER_ENABLE_WORKER_LOOP: "1",
        FREE_AI_MIXER_WORKER_POLL_INTERVAL_MS: "25",
      },
      async () => {
        const tempRoot = await createTempRoot();

        try {
          const registry = new TrackingLoopRegistry([
            createRecord({ jobId: "job-phase76-loop" }),
          ]);
          const loop = createRenderWorkerLoop(
            registry,
            createLoopAdapter,
            {
              roots: {
                temp: tempRoot,
                output: tempRoot,
              },
            },
            { workerId: "worker-phase76-loop", pollIntervalMs: 25 },
          );

          expect(loop.getStatus().enabledByEnv).toBe(true);
          expect(loop.getStatus().running).toBe(false);

          loop.start();

          await expect
            .poll(
              () =>
                loop.isRunning() &&
                registry.getByStatusCalls.length >= 1 &&
                registry.getByStatusCalls.every((call) => call === "submitted") &&
                registry.lifecycleCalls.includes("claim:job-phase76-loop") &&
                registry.lifecycleCalls.includes("markRendering:job-phase76-loop") &&
                registry.lifecycleCalls.includes("markFinalizing:job-phase76-loop") &&
                registry.lifecycleCalls.includes("markSuccess:job-phase76-loop") &&
                registry.transitionCalls === 0,
              { timeout: 5000, intervals: [25, 50, 100] },
            )
            .toBe(true);

          loop.stop();

          expect(loop.isRunning()).toBe(false);
          expect(registry.getByStatusCalls.length).toBeGreaterThanOrEqual(1);
          expect(registry.lifecycleCalls).toContain("claim:job-phase76-loop");
          expect(registry.lifecycleCalls).toContain(
            "markRendering:job-phase76-loop",
          );
          expect(registry.lifecycleCalls).toContain(
            "markFinalizing:job-phase76-loop",
          );
          expect(registry.lifecycleCalls).toContain("markSuccess:job-phase76-loop");

          const successRecord = await registry.getById("job-phase76-loop");
          const artifact = successRecord?.artifacts?.[0] as
            | Partial<BackendArtifactMetadata>
            | undefined;
          const signedUrlField = buildPattern("signed", "Url");
          const downloadUrlField = buildPattern("download", "Url");
          const storageRefField = buildPattern("storage", "Ref");

          expect(successRecord?.status).toBe("success");
          expect(successRecord?.artifacts).toHaveLength(1);
          expect(artifact).not.toHaveProperty(signedUrlField);
          expect(artifact).not.toHaveProperty(downloadUrlField);
          expect(artifact).not.toHaveProperty(storageRefField);
        } finally {
          await cleanupTempRoot(tempRoot);
        }
      },
    );
  });

  test("source keeps worker loop controlled, gated, offline, and separate from Supabase runtime selection", async () => {
    const [
      specSource,
      renderWorkerSource,
      renderWorkerStartupSource,
      renderWorkerLifecycleSource,
      backendDependenciesSource,
      appSource,
      serverSource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(renderWorkerPath),
      readFileSource(renderWorkerStartupPath),
      readFileSource(renderWorkerLifecyclePath),
      readFileSource(backendDependenciesPath),
      readFileSource(appPath),
      readFileSource(serverPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");
    const forbiddenSignedUrlField = buildPattern("signed", "Url");
    const forbiddenDownloadUrlField = buildPattern("download", "Url");
    const forbiddenStorageRefsField = buildPattern("storage", "_refs");

    expect(specSource).toContain("createRenderWorkerLoop(");
    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(renderWorkerSource).toContain(
      'FREE_AI_MIXER_ENABLE_WORKER_LOOP === "1"',
    );
    expect(renderWorkerSource).toContain("setInterval(tick, pollIntervalMs)");
    expect(renderWorkerSource).toContain("await drainRenderWorkerOnce(");
    expect(renderWorkerSource).not.toContain("registry.transition(");
    expect(renderWorkerSource).not.toContain(forbiddenSignedUrlField);
    expect(renderWorkerSource).not.toContain(forbiddenDownloadUrlField);
    expect(renderWorkerSource).not.toContain(forbiddenStorageRefsField);
    expect(renderWorkerSource).not.toContain(forbiddenSecretLogging);

    expect(renderWorkerStartupSource).toContain(
      'FREE_AI_MIXER_ENABLE_WORKER_STARTUP === "1"',
    );
    expect(renderWorkerStartupSource).toContain("loopController.start()");
    expect(renderWorkerLifecycleSource).toContain("startupController.start()");

    expect(backendDependenciesSource).toContain(
      'repositoryComposition.kind === "repository_composition_available"',
    );
    expect(backendDependenciesSource).not.toContain(
      "FREE_AI_MIXER_ENABLE_WORKER_STARTUP",
    );
    expect(backendDependenciesSource).not.toContain(
      "FREE_AI_MIXER_ENABLE_WORKER_LOOP",
    );

    expect(appSource).toContain("createRenderWorkerLifecycle(");
    expect(appSource).toContain("lifecycle.init();");
    expect(serverSource).toContain("createApp()");
  });
});
