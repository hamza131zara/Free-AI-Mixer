import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  SupabaseExportJobRegistry,
  createSupabaseExportJobRegistry,
  supabaseExportJobRegistryBoundary,
} from "../../backend/registry/supabaseExportJobRegistry";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase46-supabase-export-job-registry-boundary.spec.ts",
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

const readFileSource = async (filePath: string): Promise<string> =>
  fs.readFile(filePath, "utf8");

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

test.describe("phase46 supabase export job registry boundary", () => {
  test("adapter boundary imports offline, preserves read-only mappings, and keeps lifecycle methods fail closed", async () => {
    await withUnsetEnv(SUPABASE_ENV_KEYS, async () => {
      const readOnlyRecord = {
        jobId: "job-1",
        requestId: "request-1",
        timelineId: "timeline-1",
        ownerId: "owner-1",
        workspaceId: "workspace-1",
        status: "submitted" as const,
        attemptCount: 0,
        createdAt: "2026-05-19T16:30:40.071Z",
        updatedAt: "2026-05-19T16:30:40.071Z",
        renderSettings: {
          format: "mp4" as const,
          resolution: "720p" as const,
          fps: 24,
          quality: "draft" as const,
        },
      };

      expect(supabaseExportJobRegistryBoundary.kind).toBe(
        "supabase_export_job_registry_boundary",
      );
      expect(supabaseExportJobRegistryBoundary.wired).toBe(false);
      expect(supabaseExportJobRegistryBoundary.requiredBehaviors).toEqual([
        "lifecycle/state-machine preservation",
        "owner/workspace/requestId idempotency",
        "worker claim/TTL semantics",
        "conditional transitions",
        "artifact sanitization",
        "failure sanitization",
      ]);

      const registry = new SupabaseExportJobRegistry({
        dependencies: {
          jobsRepository: {
            getByJobId: (jobId: string) =>
              jobId === readOnlyRecord.jobId ? readOnlyRecord : undefined,
            getByIdempotencyScope: (scope: {
              ownerId: string;
              workspaceId: string;
              requestId: string;
            }) =>
              scope.ownerId === readOnlyRecord.ownerId &&
                scope.workspaceId === readOnlyRecord.workspaceId &&
                scope.requestId === readOnlyRecord.requestId
                ? readOnlyRecord
                : undefined,
          },
          accountWorkspaceRepository: { kind: "test_account_workspace_repository" },
        },
      });
      const createdRegistry = createSupabaseExportJobRegistry();

      expect(registry.kind).toBe("supabase_export_job_registry");
      await expect(registry.getById(readOnlyRecord.jobId)).resolves.toEqual(readOnlyRecord);
      await expect(
        registry.getByIdForOwner(readOnlyRecord.jobId, {
          ownerId: readOnlyRecord.ownerId,
          workspaceId: readOnlyRecord.workspaceId,
        }),
      ).resolves.toEqual(readOnlyRecord);
      await expect(
        registry.getByRequestId(readOnlyRecord.requestId, {
          ownerId: readOnlyRecord.ownerId,
          workspaceId: readOnlyRecord.workspaceId,
        }),
      ).resolves.toEqual(readOnlyRecord);
      expect(createdRegistry).toBeTruthy();

      const expectedErrorPattern =
        /SupabaseExportJobRegistry is a boundary scaffold only and is not wired for runtime DB persistence yet\./;

      await expect(
        registry.create({
          requestId: "request-1",
          timelineId: "timeline-1",
          renderSettings: {
            format: "mp4",
            resolution: "720p",
            fps: 24,
            quality: "draft",
          },
        }),
      ).rejects.toThrow(expectedErrorPattern);
      await expect(registry.getByRequestId("request-1")).rejects.toThrow(
        /getByRequestId requires ownerScope/,
      );
      await expect(registry.getByStatus("submitted")).rejects.toThrow(expectedErrorPattern);
      await expect(registry.claim("job-1", "worker-1")).rejects.toThrow(expectedErrorPattern);
      await expect(registry.markRendering("job-1", "worker-1")).rejects.toThrow(expectedErrorPattern);
      await expect(registry.markFinalizing("job-1", "worker-1")).rejects.toThrow(expectedErrorPattern);
      await expect(
        registry.markSuccess("job-1", "worker-1", []),
      ).rejects.toThrow(expectedErrorPattern);
      await expect(
        registry.markError("job-1", "worker-1", {
          message: "failure",
        }),
      ).rejects.toThrow(expectedErrorPattern);
      await expect(registry.transition("job-1", "rendering")).rejects.toThrow(
        expectedErrorPattern,
      );
    });
  });

  test("source proves boundary isolation and no app, route, worker, or cli wiring", async () => {
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
    expect(specSource).toContain("createSupabaseExportJobRegistry");
    expect(specSource).toContain("supabaseExportJobRegistryBoundary");
    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(adapterSource).toContain("implements ExportJobRegistry");
    expect(adapterSource).toContain("boundary scaffold only");
    expect(adapterSource).toContain("lifecycle/state-machine preservation");
    expect(adapterSource).toContain("owner/workspace/requestId idempotency");
    expect(adapterSource).toContain("worker claim/TTL semantics");
    expect(adapterSource).toContain("conditional transitions");
    expect(adapterSource).toContain("artifact sanitization");
    expect(adapterSource).toContain("failure sanitization");
    expect(adapterSource).not.toContain("../../backend/routes/");
    expect(adapterSource).not.toContain("../routes/");
    expect(adapterSource).not.toContain("../app");
    expect(adapterSource).not.toContain("../server");
    expect(adapterSource).not.toContain("../composition/");
    expect(adapterSource).not.toContain("../../src/");
    expect(adapterSource).not.toContain("createClient(");
    expect(adapterSource).not.toContain("readSupabaseConfigFromEnv");
    expect(adapterSource).not.toContain(forbiddenSecretLogging);
    expect(adapterSource).not.toContain(forbiddenSupabaseStart);
    expect(adapterSource).not.toContain(forbiddenSupabaseLink);
    expect(adapterSource).not.toContain(forbiddenSupabaseDb);
    expect(adapterSource).toContain("private async readRequiredAsync");
    expect(adapterSource).not.toContain("return []");
    expect(adapterSource).not.toContain('status: "success"');

    expect(appSource).not.toContain("SupabaseExportJobRegistry");
    expect(exportsRouteSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerLifecycleSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerStartupSource).not.toContain("SupabaseExportJobRegistry");
    expect(appSource).toContain("createExportRouter(backendDeps.registry, exportRouterOptions)");
    expect(exportsRouteSource).toContain("await registry.getByRequestId");
    expect(renderWorkerSource).toContain('await registry.getByStatus("submitted")');
  });
});
