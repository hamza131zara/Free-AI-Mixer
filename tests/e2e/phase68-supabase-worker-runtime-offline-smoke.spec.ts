import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
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
import {
  createRenderWorkerLoop,
  drainRenderWorkerOnce,
} from "../../backend/workers/renderWorker";
import type { RendererAdapterInput, RendererAdapterResult } from "../../backend/renderer/singleProcessRenderHarness";
import type { RenderOutputPathPolicy } from "../../backend/renderer/outputPathPolicy";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase68-supabase-worker-runtime-offline-smoke.spec.ts",
);
const renderWorkerPath = path.join(
  process.cwd(),
  "backend",
  "workers",
  "renderWorker.ts",
);
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
const routesPath = path.join(process.cwd(), "backend", "routes", "exports.ts");
const appPath = path.join(process.cwd(), "backend", "app.ts");

const WORKER_ENV_KEYS = [
  "FREE_AI_MIXER_ENABLE_WORKER_LOOP",
  "FREE_AI_MIXER_WORKER_POLL_INTERVAL_MS",
] as const;

const defaultOwnerScope: BackendExportJobOwnerScope = {
  ownerId: "local-dev-owner",
  workspaceId: "local-dev-workspace",
};

const readFileSource = async (filePath: string): Promise<string> =>
  fs.readFile(filePath, "utf8");

const withEnv = async (
  values: Partial<Record<(typeof WORKER_ENV_KEYS)[number], string>>,
  run: () => Promise<void>,
): Promise<void> => {
  const previous = new Map<string, string | undefined>();

  for (const key of WORKER_ENV_KEYS) {
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
    for (const key of WORKER_ENV_KEYS) {
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
  fs.mkdtemp(path.join(os.tmpdir(), "phase68-worker-"));

const cleanupTempRoot = async (rootPath: string): Promise<void> => {
  await fs.rm(rootPath, { recursive: true, force: true });
};

const createRecord = (
  overrides: Partial<BackendExportJobRecord> = {},
): BackendExportJobRecord => ({
  jobId: "job-phase68-default",
  requestId: "request-phase68-default",
  timelineId: "timeline-phase68-default",
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

class TrackingWorkerRegistry implements ExportJobRegistry {
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
    throw new Error("create should not be called in phase68 worker smoke");
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
    throw new Error("getByRequestId should not be called in phase68 worker smoke");
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
    if (record.status !== "submitted") {
      throw new Error(`Cannot claim non-submitted job ${jobId}`);
    }
    record.claimedByWorkerId = workerId;
    record.status = "submitted";
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
    record.artifacts = artifacts as BackendArtifactMetadata[];
    record.completedAt = "2026-05-20T12:13:00.000Z";
    record.updatedAt = "2026-05-20T12:13:00.000Z";
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
    throw new Error("transition should not be called in phase68 worker smoke");
  }
}

const createWorkerAdapter = (
  outputRoot: string,
): ((input: RendererAdapterInput) => Promise<RendererAdapterResult>) => {
  return async (input: RendererAdapterInput) => {
    if (input.snapshot.jobId === "job-phase68-success") {
      await fs.mkdir(input.resolvedOutputPath.directoryPath, { recursive: true });
      await fs.writeFile(
        input.resolvedOutputPath.filePath,
        Buffer.from("phase68-video-bytes"),
      );
      return { ok: true };
    }

    return {
      ok: false,
      error: new Error("worker adapter failed"),
      transient: false,
    };
  };
};

test.describe("phase68 supabase worker runtime offline smoke", () => {
  test("drainRenderWorkerOnce uses supported lifecycle methods, keeps deterministic order, skips terminal jobs defensively, and counts outcomes truthfully", async () => {
    const tempRoot = await createTempRoot();
    const pathPolicy: RenderOutputPathPolicy = {
      roots: {
        temp: path.join(tempRoot, "temp"),
        output: path.join(tempRoot, "output"),
      },
    };

    const registry = new TrackingWorkerRegistry([
      createRecord({
        jobId: "job-phase68-success",
        requestId: "request-phase68-success",
      }),
      createRecord({
        jobId: "job-phase68-terminal",
        requestId: "request-phase68-terminal",
        status: "error",
        failure: {
          code: "already_failed",
          message: "Already failed.",
        },
      }),
      createRecord({
        jobId: "job-phase68-failure",
        requestId: "request-phase68-failure",
      }),
    ]);

    try {
      const result = await drainRenderWorkerOnce(
        registry,
        createWorkerAdapter(path.join(tempRoot, "output")),
        pathPolicy,
        { workerId: "worker-phase68" },
      );

      expect(registry.getByStatusCalls).toEqual(["submitted"]);
      expect(result.workerId).toBe("worker-phase68");
      expect(result.attemptedJobIds).toEqual([
        "job-phase68-success",
        "job-phase68-terminal",
        "job-phase68-failure",
      ]);
      expect(result.acceptedCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.jobId).toBe("job-phase68-failure");
      expect(result.errors[0]?.code).toBe("renderer_execution_failed");
      expect(registry.transitionCalls).toBe(0);
      expect(registry.lifecycleCalls).toEqual([
        "claim:job-phase68-success",
        "markRendering:job-phase68-success",
        "markFinalizing:job-phase68-success",
        "markSuccess:job-phase68-success",
        "claim:job-phase68-failure",
        "markRendering:job-phase68-failure",
        "markError:job-phase68-failure",
      ]);

      await expect(registry.getById("job-phase68-success")).resolves.toMatchObject({
        status: "success",
      });
      await expect(registry.getById("job-phase68-failure")).resolves.toMatchObject({
        status: "error",
      });
      await expect(registry.getById("job-phase68-terminal")).resolves.toMatchObject({
        status: "error",
      });
    } finally {
      await cleanupTempRoot(tempRoot);
    }
  });

  test("worker loop gating stays separate from runtime registry selection and source guards remain offline with no CLI, secret logging, signed-url behavior, or route rollout implications", async () => {
    const specSource = await readFileSource(specPath);
    const [
      renderWorkerSource,
      harnessSource,
      backendDependenciesSource,
      routesSource,
      appSource,
    ] = await Promise.all([
      readFileSource(renderWorkerPath),
      readFileSource(harnessPath),
      readFileSource(backendDependenciesPath),
      readFileSource(routesPath),
      readFileSource(appPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");

    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(renderWorkerSource).toContain('await registry.getByStatus("submitted")');
    expect(renderWorkerSource).toContain(
      'FREE_AI_MIXER_ENABLE_WORKER_LOOP === "1"',
    );
    expect(renderWorkerSource).toContain("executeRenderJob({");
    expect(renderWorkerSource).not.toContain("registry.transition(");
    expect(renderWorkerSource).not.toContain("signedUrl");
    expect(renderWorkerSource).not.toContain("downloadUrl");
    expect(renderWorkerSource).not.toContain("storage_refs");
    expect(renderWorkerSource).not.toContain(forbiddenSecretLogging);

    expect(harnessSource).toContain("await input.registry.claim");
    expect(harnessSource).toContain("await input.registry.markRendering");
    expect(harnessSource).toContain("await input.registry.markFinalizing");
    expect(harnessSource).toContain("await input.registry.markSuccess");
    expect(harnessSource).toContain("await input.registry.markError");
    expect(harnessSource).not.toContain("input.registry.transition(");

    expect(backendDependenciesSource).toContain("new SupabaseExportJobRegistry");
    expect(backendDependenciesSource).not.toContain(
      "FREE_AI_MIXER_ENABLE_WORKER_LOOP",
    );
    expect(routesSource).toContain(
      'FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION === "1"',
    );
    expect(appSource).toContain("createRenderWorkerLifecycle(");
    expect(appSource).not.toContain("SupabaseExportJobRegistry");

    const inertRegistry = new TrackingWorkerRegistry([]);
    await withEnv({}, async () => {
      const tempRoot = await createTempRoot();
      try {
        const loop = createRenderWorkerLoop(
          inertRegistry,
          async () => ({ ok: true }),
          {
            roots: {
              temp: path.join(tempRoot, "temp"),
              output: path.join(tempRoot, "output"),
            },
          },
          {
            workerId: "worker-loop-phase68",
            pollIntervalMs: 5,
          },
        );
        loop.start();

        expect(loop.getStatus().enabledByEnv).toBe(false);
        expect(loop.getStatus().running).toBe(false);
        expect(loop.isRunning()).toBe(false);
        expect(inertRegistry.getByStatusCalls).toEqual([]);
      } finally {
        await cleanupTempRoot(tempRoot);
      }
    });
  });
});
