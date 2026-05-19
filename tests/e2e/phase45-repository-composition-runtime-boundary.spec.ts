import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createApp } from "../../backend/app";
import { createBackendDependencies } from "../../backend/composition/backendDependencies";
import { createRepositoryComposition } from "../../backend/composition/repositoryComposition";
import { readSupabaseConfigFromEnv } from "../../backend/config/supabaseConfig";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase45-repository-composition-runtime-boundary.spec.ts",
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
  "FREE_AI_MIXER_ENABLE_DB_MIGRATIONS",
  "VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
  "FREE_AI_MIXER_RUN_REMOTE_SUPABASE_SMOKE",
  "FREE_AI_MIXER_RUN_REMOTE_ACCOUNT_WORKSPACE_REPOSITORY_SMOKE",
  "FREE_AI_MIXER_RUN_REMOTE_EXPORT_JOBS_REPOSITORY_SMOKE",
  "FREE_AI_MIXER_PERSISTENCE_ENABLED",
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

const buildForbiddenRemoteEnvPattern = (): string =>
  [
    "process",
    "env",
    ["FREE", "AI", "MIXER", "SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"),
  ].join(".");

test.describe("phase45 repository composition runtime boundary", () => {
  test("default dependencies stay offline and app creation does not require supabase env", async () => {
    await withUnsetEnv(SUPABASE_ENV_KEYS, async () => {
      const supabaseConfig = readSupabaseConfigFromEnv(process.env);
      expect(supabaseConfig.enabled).toBe(false);
      expect(supabaseConfig.valid).toBe(true);

      const backendDeps = createBackendDependencies();
      expect(backendDeps.repositoryComposition.kind).toBe("repository_composition_disabled");
      expect(backendDeps.repositoryComposition.dbBacked).toBe(false);
      expect(backendDeps.repositoryComposition.reason).toBe("disabled");
      expect(backendDeps.registry.constructor.name).toBe("InMemoryExportJobRegistry");
      expect(backendDeps.rendererAdapter).toBeTruthy();
      expect(backendDeps.pathPolicy).toBeTruthy();

      const directComposition = createRepositoryComposition(supabaseConfig);
      expect(directComposition.kind).toBe("repository_composition_disabled");
      expect(directComposition.dbBacked).toBe(false);
      expect(directComposition.reason).toBe("disabled");

      const app = createApp();
      expect(app).toBeTruthy();
      expect(app.locals.renderWorkerLifecycle).toBeTruthy();
      expect(typeof app.locals.renderWorkerLifecycle.getStatus).toBe("function");
    });
  });

  test("source proves repository composition remains isolated from route and worker runtime", async () => {
    const [
      specSource,
      appSource,
      exportsRouteSource,
      renderWorkerSource,
      renderWorkerLifecycleSource,
      renderWorkerStartupSource,
    ] = await Promise.all([
      readFileSource(specPath),
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
    const forbiddenRemoteEnv = buildForbiddenRemoteEnvPattern();

    expect(specSource).toContain("createBackendDependencies");
    expect(specSource).toContain("createRepositoryComposition");
    expect(specSource).toContain("createApp");
    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);
    expect(specSource).not.toContain(forbiddenRemoteEnv);

    expect(appSource).toContain("createBackendDependencies");
    expect(appSource).toContain("createExportRouter(backendDeps.registry, exportRouterOptions)");
    expect(appSource).not.toContain("SupabaseExportJobsRepository");
    expect(appSource).not.toContain("SupabaseAccountWorkspaceRepository");
    expect(appSource).not.toContain("repositoryComposition, exportRouterOptions");

    expect(exportsRouteSource).toContain("createExportRouter = (registry: ExportJobRegistry");
    expect(exportsRouteSource).toContain("registry.getByRequestId");
    expect(exportsRouteSource).toContain("registry.getByIdForOwner");
    expect(exportsRouteSource).not.toContain("SupabaseExportJobsRepository");
    expect(exportsRouteSource).not.toContain("SupabaseAccountWorkspaceRepository");
    expect(exportsRouteSource).not.toContain("repositoryComposition");

    expect(renderWorkerSource).toContain("registry.getByStatus");
    expect(renderWorkerSource).toContain("executeRenderJob");
    expect(renderWorkerSource).not.toContain("repositoryComposition");
    expect(renderWorkerSource).not.toContain("SupabaseExportJobsRepository");

    expect(renderWorkerLifecycleSource).toContain("registry: ExportJobRegistry");
    expect(renderWorkerLifecycleSource).not.toContain("repositoryComposition");
    expect(renderWorkerLifecycleSource).not.toContain("SupabaseExportJobsRepository");

    expect(renderWorkerStartupSource).toContain("registry: ExportJobRegistry");
    expect(renderWorkerStartupSource).not.toContain("repositoryComposition");
    expect(renderWorkerStartupSource).not.toContain("SupabaseExportJobsRepository");
  });
});
