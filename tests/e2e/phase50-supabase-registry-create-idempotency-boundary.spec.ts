import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { BackendExportJobRecord } from "../../backend/contracts/exportHttpTypes";
import {
  SupabaseExportJobRegistry,
  type SupabaseExportJobRegistryReadRepository,
} from "../../backend/registry/supabaseExportJobRegistry";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase50-supabase-registry-create-idempotency-boundary.spec.ts",
);
const adapterPath = path.join(
  process.cwd(),
  "backend",
  "registry",
  "supabaseExportJobRegistry.ts",
);
const appPath = path.join(process.cwd(), "backend", "app.ts");
const backendDependenciesPath = path.join(
  process.cwd(),
  "backend",
  "composition",
  "backendDependencies.ts",
);
const exportsRoutePath = path.join(
  process.cwd(),
  "backend",
  "routes",
  "exports.ts",
);
const renderWorkerPath = path.join(
  process.cwd(),
  "backend",
  "workers",
  "renderWorker.ts",
);

const SUPABASE_ENV_KEYS = [
  "FREE_AI_MIXER_ENABLE_SUPABASE_DB",
  "FREE_AI_MIXER_DB_PROVIDER",
  "FREE_AI_MIXER_SUPABASE_URL",
  "FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
  "FREE_AI_MIXER_SUPABASE_ANON_KEY",
  "FREE_AI_MIXER_DATABASE_URL",
  "VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
  "FREE_AI_MIXER_RUN_REMOTE_SUPABASE_SMOKE",
  "FREE_AI_MIXER_RUN_REMOTE_ACCOUNT_WORKSPACE_REPOSITORY_SMOKE",
  "FREE_AI_MIXER_RUN_REMOTE_EXPORT_JOBS_REPOSITORY_SMOKE",
] as const;

const readFileSource = async (filePath: string): Promise<string> =>
  fs.readFile(filePath, "utf8");

const withUnsetEnv = async (
  keys: readonly string[],
  run: () => Promise<void>,
): Promise<void> => {
  const previous = new Map<string, string | undefined>();

  for (const key of keys) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }

  try {
    await run();
  } finally {
    for (const key of keys) {
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

const createRecord = (): BackendExportJobRecord => ({
  jobId: "job-50",
  requestId: "request-50",
  timelineId: "timeline-50",
  ownerId: "owner-50",
  workspaceId: "workspace-50",
  status: "submitted",
  attemptCount: 0,
  createdAt: "2026-05-19T16:30:40.071Z",
  updatedAt: "2026-05-19T16:30:40.071Z",
  renderSettings: {
    format: "mp4",
    resolution: "720p",
    fps: 24,
    quality: "draft",
  },
});

test.describe("phase50 supabase registry create/idempotency boundary", () => {
  test("create uses createIfAbsent without broad upsert and owner-scoped idempotency read remains the only safe path", async () => {
    await withUnsetEnv(SUPABASE_ENV_KEYS, async () => {
      const record = createRecord();
      const calls: string[] = [];
      let upsertCalled = false;
      let createIfAbsentCalled = false;

      const fakeRepository: SupabaseExportJobRegistryReadRepository & {
        createIfAbsent: (candidate: BackendExportJobRecord) => Promise<{
          kind: "created";
          record: BackendExportJobRecord;
        }>;
        upsertJob: () => Promise<BackendExportJobRecord>;
      } = {
        createIfAbsent: async (candidate) => {
          createIfAbsentCalled = true;
          calls.push(`createIfAbsent:${candidate.requestId}`);
          return {
            kind: "created",
            record: candidate,
          };
        },
        getByJobId: (jobId) => {
          calls.push(`getByJobId:${jobId}`);
          return jobId === record.jobId ? record : undefined;
        },
        getByIdempotencyScope: (scope) => {
          calls.push(
            `getByIdempotencyScope:${scope.ownerId}:${scope.workspaceId}:${scope.requestId}`,
          );
          return scope.ownerId === record.ownerId &&
              scope.workspaceId === record.workspaceId &&
              scope.requestId === record.requestId
            ? record
            : undefined;
        },
        upsertJob: async () => {
          upsertCalled = true;
          return record;
        },
      };

      const registry = new SupabaseExportJobRegistry({
        dependencies: {
          jobsRepository: fakeRepository,
        },
      });
      await expect(
        registry.create({
          requestId: "request-create",
          timelineId: "timeline-create",
          renderSettings: record.renderSettings,
          ownerId: record.ownerId,
          workspaceId: record.workspaceId,
        }),
      ).resolves.toMatchObject({
        requestId: "request-create",
        timelineId: "timeline-create",
        ownerId: record.ownerId,
        workspaceId: record.workspaceId,
        status: "submitted",
        attemptCount: 0,
      });
      expect(createIfAbsentCalled).toBe(true);
      expect(upsertCalled).toBe(false);
      expect(calls).toEqual(["createIfAbsent:request-create"]);

      const expectedErrorPattern =
        /SupabaseExportJobRegistry is a boundary scaffold only and is not wired for runtime DB persistence yet\./;

      calls.length = 0;
      await expect(
        registry.getByRequestId(record.requestId, {
          ownerId: record.ownerId,
          workspaceId: record.workspaceId,
        }),
      ).resolves.toBe(record);
      expect(calls).toEqual([
        `getByIdempotencyScope:${record.ownerId}:${record.workspaceId}:${record.requestId}`,
      ]);

      calls.length = 0;
      await expect(registry.getByRequestId(record.requestId)).rejects.toThrow(
        /getByRequestId requires ownerScope/,
      );
      expect(calls).toEqual([]);

      await expect(registry.getByStatus("submitted")).rejects.toThrow(expectedErrorPattern);
      await expect(registry.claim(record.jobId, "worker-50")).rejects.toThrow(
        expectedErrorPattern,
      );
      await expect(registry.markRendering(record.jobId, "worker-50")).rejects.toThrow(
        expectedErrorPattern,
      );
      await expect(registry.markFinalizing(record.jobId, "worker-50")).rejects.toThrow(
        expectedErrorPattern,
      );
      await expect(registry.markSuccess(record.jobId, "worker-50", [])).rejects.toThrow(
        expectedErrorPattern,
      );
      await expect(
        registry.markError(record.jobId, "worker-50", { message: "failure" }),
      ).rejects.toThrow(expectedErrorPattern);
      await expect(registry.transition(record.jobId, "rendering")).rejects.toThrow(
        expectedErrorPattern,
      );
      expect(upsertCalled).toBe(false);
    });
  });

  test("source proves unsafe create wiring, runtime DB wiring, cli usage, and secret logging are absent", async () => {
    const [
      specSource,
      adapterSource,
      appSource,
      backendDependenciesSource,
      exportsRouteSource,
      renderWorkerSource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(adapterPath),
      readFileSource(appPath),
      readFileSource(backendDependenciesPath),
      readFileSource(exportsRoutePath),
      readFileSource(renderWorkerPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");

    expect(specSource).toContain("upsertCalled = false");
    expect(specSource).toContain("createIfAbsentCalled = false");
    expect(specSource).toContain("getByRequestId requires ownerScope");
    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(adapterSource).toContain("async create(_input: CreateExportJobInput)");
    expect(adapterSource).toContain("jobsRepository.createIfAbsent(record)");
    expect(adapterSource).toContain("jobsRepository.getByIdempotencyScope({");
    expect(adapterSource).toContain("getByRequestId requires ownerScope");
    expect(adapterSource).not.toContain("upsertJob");
    expect(adapterSource).not.toContain("createClient(");
    expect(adapterSource).not.toContain("readSupabaseConfigFromEnv");
    expect(adapterSource).not.toContain(forbiddenSecretLogging);
    expect(adapterSource).not.toContain(forbiddenSupabaseStart);
    expect(adapterSource).not.toContain(forbiddenSupabaseLink);
    expect(adapterSource).not.toContain(forbiddenSupabaseDb);

    expect(appSource).not.toContain("SupabaseExportJobRegistry");
    expect(backendDependenciesSource).not.toContain("SupabaseExportJobRegistry");
    expect(exportsRouteSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerSource).not.toContain("SupabaseExportJobRegistry");
    expect(backendDependenciesSource).toContain("repositoryComposition");
    expect(backendDependenciesSource).toContain("new InMemoryExportJobRegistry()");
    expect(exportsRouteSource).toContain("await registry.getByRequestId");
    expect(renderWorkerSource).toContain('await registry.getByStatus("submitted")');
  });
});
