import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { BackendExportJobRecord } from "../../backend/contracts/exportHttpTypes";
import {
  SupabaseExportJobRegistry,
  createSupabaseExportJobRegistry,
  supabaseExportJobRegistryBoundary,
  type SupabaseExportJobRegistryReadRepository,
} from "../../backend/registry/supabaseExportJobRegistry";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase47-supabase-export-job-registry-method-mapping.spec.ts",
);
const adapterPath = path.join(
  process.cwd(),
  "backend",
  "registry",
  "supabaseExportJobRegistry.ts",
);
const appPath = path.join(process.cwd(), "backend", "app.ts");
const exportsRoutePath = path.join(process.cwd(), "backend", "routes", "exports.ts");
const renderWorkerPath = path.join(process.cwd(), "backend", "workers", "renderWorker.ts");
const renderWorkerLifecyclePath = path.join(
  process.cwd(),
  "backend",
  "workers",
  "renderWorkerLifecycle.ts",
);
const renderWorkerStartupPath = path.join(
  process.cwd(),
  "backend",
  "workers",
  "renderWorkerStartup.ts",
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
  jobId: "job-1",
  requestId: "request-1",
  timelineId: "timeline-1",
  ownerId: "owner-1",
  workspaceId: "workspace-1",
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

test.describe("phase47 supabase export job registry method mapping", () => {
  test("adapter imports offline, maps safe read-only methods, and keeps mutating methods fail-closed", async () => {
    await withUnsetEnv(SUPABASE_ENV_KEYS, async () => {
      const record = createRecord();
      const calls: string[] = [];
      const fakeRepository: SupabaseExportJobRegistryReadRepository = {
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
      };

      const registry = new SupabaseExportJobRegistry({
        dependencies: {
          jobsRepository: fakeRepository,
        },
      });
      const createdRegistry = createSupabaseExportJobRegistry({
        dependencies: {
          jobsRepository: fakeRepository,
        },
      });

      expect(supabaseExportJobRegistryBoundary.wired).toBe(false);
      expect(createdRegistry).toBeTruthy();
      expect(registry.getById(record.jobId)).toBe(record);
      expect(calls).toEqual([`getByJobId:${record.jobId}`]);

      calls.length = 0;
      expect(
        registry.getByIdForOwner(record.jobId, {
          ownerId: record.ownerId,
          workspaceId: record.workspaceId,
        }),
      ).toBe(record);
      expect(calls).toEqual([`getByJobId:${record.jobId}`]);

      calls.length = 0;
      expect(
        registry.getByIdForOwner(record.jobId, {
          ownerId: "owner-2",
          workspaceId: record.workspaceId,
        }),
      ).toBeUndefined();
      expect(calls).toEqual([`getByJobId:${record.jobId}`]);

      calls.length = 0;
      expect(
        registry.getByRequestId(record.requestId, {
          ownerId: record.ownerId,
          workspaceId: record.workspaceId,
        }),
      ).toBe(record);
      expect(calls).toEqual([
        `getByIdempotencyScope:${record.ownerId}:${record.workspaceId}:${record.requestId}`,
      ]);

      const expectedErrorPattern =
        /SupabaseExportJobRegistry is a boundary scaffold only and is not wired for runtime DB persistence yet\./;

      expect(() => registry.getByRequestId(record.requestId)).toThrow(
        /getByRequestId requires ownerScope/,
      );
      expect(() =>
        registry.create({
          requestId: "request-2",
          timelineId: "timeline-2",
          renderSettings: record.renderSettings,
        }),
      ).toThrow(expectedErrorPattern);
      expect(() => registry.getByStatus("submitted")).toThrow(expectedErrorPattern);
      expect(() => registry.claim(record.jobId, "worker-1")).toThrow(expectedErrorPattern);
      expect(() => registry.markRendering(record.jobId, "worker-1")).toThrow(
        expectedErrorPattern,
      );
      expect(() => registry.markFinalizing(record.jobId, "worker-1")).toThrow(
        expectedErrorPattern,
      );
      expect(() => registry.markSuccess(record.jobId, "worker-1", [])).toThrow(
        expectedErrorPattern,
      );
      expect(() =>
        registry.markError(record.jobId, "worker-1", { message: "failure" }),
      ).toThrow(expectedErrorPattern);
      expect(() => registry.transition(record.jobId, "rendering")).toThrow(
        expectedErrorPattern,
      );
    });
  });

  test("source proves offline-only boundary and no app, route, worker, env, or cli wiring", async () => {
    const [
      specSource,
      adapterSource,
      appSource,
      exportsRouteSource,
      renderWorkerSource,
      renderWorkerLifecycleSource,
      renderWorkerStartupSource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(adapterPath),
      readFileSource(appPath),
      readFileSource(exportsRoutePath),
      readFileSource(renderWorkerPath),
      readFileSource(renderWorkerLifecyclePath),
      readFileSource(renderWorkerStartupPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");

    expect(specSource).toContain("SupabaseExportJobRegistry");
    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(adapterSource).toContain("getByJobId(jobId)");
    expect(adapterSource).toContain("getByIdempotencyScope({");
    expect(adapterSource).toContain("getByRequestId requires ownerScope");
    expect(adapterSource).toContain("async repository dependency");
    expect(adapterSource).toContain("implements ExportJobRegistry");
    expect(adapterSource).not.toContain("../routes/");
    expect(adapterSource).not.toContain("../app");
    expect(adapterSource).not.toContain("../server");
    expect(adapterSource).not.toContain("../composition/");
    expect(adapterSource).not.toContain("createClient(");
    expect(adapterSource).not.toContain("readSupabaseConfigFromEnv");
    expect(adapterSource).not.toContain(forbiddenSecretLogging);
    expect(adapterSource).not.toContain(forbiddenSupabaseStart);
    expect(adapterSource).not.toContain(forbiddenSupabaseLink);
    expect(adapterSource).not.toContain(forbiddenSupabaseDb);

    expect(appSource).not.toContain("SupabaseExportJobRegistry");
    expect(exportsRouteSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerLifecycleSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerStartupSource).not.toContain("SupabaseExportJobRegistry");
    expect(appSource).toContain(
      "createExportRouter(backendDeps.registry, exportRouterOptions)",
    );
    expect(exportsRouteSource).toContain("registry.getByRequestId");
    expect(renderWorkerSource).toContain("registry.getByStatus");
  });
});
