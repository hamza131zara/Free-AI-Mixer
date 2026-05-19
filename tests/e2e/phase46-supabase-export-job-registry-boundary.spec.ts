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
  test("adapter boundary imports offline and every registry method fails closed", async () => {
    await withUnsetEnv(SUPABASE_ENV_KEYS, async () => {
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
          jobsRepository: { kind: "test_jobs_repository" },
          accountWorkspaceRepository: { kind: "test_account_workspace_repository" },
        },
      });
      const createdRegistry = createSupabaseExportJobRegistry();

      expect(registry.kind).toBe("supabase_export_job_registry");
      expect(registry.dependencies?.jobsRepository).toEqual({
        kind: "test_jobs_repository",
      });
      expect(createdRegistry).toBeTruthy();

      const expectedErrorPattern =
        /SupabaseExportJobRegistry is a boundary scaffold only and is not wired for runtime DB persistence yet\./;

      expect(() =>
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
      ).toThrow(expectedErrorPattern);
      expect(() => registry.getById("job-1")).toThrow(expectedErrorPattern);
      expect(() =>
        registry.getByIdForOwner("job-1", {
          ownerId: "owner-1",
          workspaceId: "workspace-1",
        }),
      ).toThrow(expectedErrorPattern);
      expect(() =>
        registry.getByRequestId("request-1", {
          ownerId: "owner-1",
          workspaceId: "workspace-1",
        }),
      ).toThrow(expectedErrorPattern);
      expect(() => registry.getByStatus("submitted")).toThrow(expectedErrorPattern);
      expect(() => registry.claim("job-1", "worker-1")).toThrow(expectedErrorPattern);
      expect(() => registry.markRendering("job-1", "worker-1")).toThrow(expectedErrorPattern);
      expect(() => registry.markFinalizing("job-1", "worker-1")).toThrow(expectedErrorPattern);
      expect(() =>
        registry.markSuccess("job-1", "worker-1", []),
      ).toThrow(expectedErrorPattern);
      expect(() =>
        registry.markError("job-1", "worker-1", {
          message: "failure",
        }),
      ).toThrow(expectedErrorPattern);
      expect(() => registry.transition("job-1", "rendering")).toThrow(
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
    expect(adapterSource).not.toContain("return []");
    expect(adapterSource).not.toContain('status: "success"');

    expect(appSource).not.toContain("SupabaseExportJobRegistry");
    expect(exportsRouteSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerLifecycleSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerStartupSource).not.toContain("SupabaseExportJobRegistry");
    expect(appSource).toContain("createExportRouter(backendDeps.registry, exportRouterOptions)");
    expect(exportsRouteSource).toContain("registry.getByRequestId");
    expect(renderWorkerSource).toContain("registry.getByStatus");
  });
});
