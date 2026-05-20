import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createBackendDependencies } from "../../backend/composition/backendDependencies";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase53-supabase-runtime-registry-read-create-boundary.spec.ts",
);
const appPath = path.join(process.cwd(), "backend", "app.ts");
const backendDependenciesPath = path.join(
  process.cwd(),
  "backend",
  "composition",
  "backendDependencies.ts",
);
const repositoryCompositionPath = path.join(
  process.cwd(),
  "backend",
  "composition",
  "repositoryComposition.ts",
);
const registryPath = path.join(
  process.cwd(),
  "backend",
  "registry",
  "supabaseExportJobRegistry.ts",
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
const harnessPath = path.join(
  process.cwd(),
  "backend",
  "renderer",
  "singleProcessRenderHarness.ts",
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
  "FREE_AI_MIXER_PERSISTENCE_ENABLED",
  "FREE_AI_MIXER_PERSISTENCE_FILE_PATH",
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

test.describe("phase53 supabase runtime registry read/create boundary", () => {
  test("backend dependencies stay local by default and repository composition does not imply runtime registry wiring", async () => {
    await withUnsetEnv(SUPABASE_ENV_KEYS, async () => {
      const backendDependencies = createBackendDependencies();

      expect(backendDependencies.registry).toBeTruthy();
      expect(backendDependencies.registry.constructor.name).toBe(
        "InMemoryExportJobRegistry",
      );
      expect(
        (backendDependencies.registry as { kind?: string }).kind,
      ).not.toBe("supabase_export_job_registry");

      expect(backendDependencies.repositoryComposition.kind).toBe(
        "repository_composition_disabled",
      );
      expect(backendDependencies.repositoryComposition.dbBacked).toBe(false);
      expect(backendDependencies.repositoryComposition.enabled).toBe(false);
      expect(backendDependencies.repositoryComposition.valid).toBe(true);
      expect(backendDependencies.repositoryComposition.reason).toBe("disabled");
    });
  });

  test("source proves one registry serves submit/read/execute routes while runtime selection is still gated in backendDependencies and worker activation remains separate", async () => {
    const [
      specSource,
      appSource,
      backendDependenciesSource,
      repositoryCompositionSource,
      registrySource,
      exportsRouteSource,
      renderWorkerSource,
      harnessSource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(appPath),
      readFileSource(backendDependenciesPath),
      readFileSource(repositoryCompositionPath),
      readFileSource(registryPath),
      readFileSource(exportsRoutePath),
      readFileSource(renderWorkerPath),
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

    expect(appSource).toContain(
      "createExportRouter(backendDeps.registry, exportRouterOptions)",
    );
    expect(appSource).not.toContain("SupabaseExportJobRegistry");

    expect(backendDependenciesSource).toContain("repositoryComposition");
    expect(backendDependenciesSource).toContain("new SupabaseExportJobRegistry");
    expect(backendDependenciesSource).toContain("repositoryComposition.createRepositories().exportJobsRepository");
    expect(backendDependenciesSource).toContain("new InMemoryExportJobRegistry()");

    expect(repositoryCompositionSource).toContain("createSupabaseExportJobsRepository");
    expect(repositoryCompositionSource).not.toContain("SupabaseExportJobRegistry");

    expect(registrySource).toContain("async create(_input: CreateExportJobInput)");
    expect(registrySource).toContain("async getById(jobId: string)");
    expect(registrySource).toContain("async getByIdForOwner(");
    expect(registrySource).toContain("async getByRequestId(");
    expect(registrySource).toContain("async getByStatus(");
    expect(registrySource).toContain("jobsRepository.listByStatus(status)");
    expect(registrySource).toContain("async claim(");
    expect(registrySource).toContain("async markRendering(");
    expect(registrySource).toContain("async markFinalizing(");
    expect(registrySource).toContain("async markSuccess(");
    expect(registrySource).toContain("async markError(");
    expect(registrySource).toContain('throw this.createNotWiredError("transition")');
    expect(registrySource).not.toContain("readSupabaseConfigFromEnv");
    expect(registrySource).not.toContain("createClient(");
    expect(registrySource).not.toContain(forbiddenSecretLogging);
    expect(registrySource).not.toContain(forbiddenSupabaseStart);
    expect(registrySource).not.toContain(forbiddenSupabaseLink);
    expect(registrySource).not.toContain(forbiddenSupabaseDb);

    expect(exportsRouteSource).toContain("await registry.getByRequestId");
    expect(exportsRouteSource).toContain("await registry.create({");
    expect(exportsRouteSource).toContain("await registry.getByIdForOwner");
    expect(exportsRouteSource).toContain("executeRenderJob({");
    expect(exportsRouteSource).toContain("registry,");
    expect(exportsRouteSource).not.toContain("SupabaseExportJobRegistry");
    expect(exportsRouteSource).toContain("FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION === \"1\"");

    expect(renderWorkerSource).toContain('await registry.getByStatus("submitted")');
    expect(renderWorkerSource).toContain("FREE_AI_MIXER_ENABLE_WORKER_LOOP === \"1\"");
    expect(renderWorkerSource).not.toContain("SupabaseExportJobRegistry");

    expect(harnessSource).toContain("await input.registry.claim");
    expect(harnessSource).toContain("await input.registry.markRendering");
    expect(harnessSource).toContain("await input.registry.markFinalizing");
    expect(harnessSource).toContain("await input.registry.markSuccess");
    expect(harnessSource).toContain("await input.registry.markError");
    expect(harnessSource).not.toContain("SupabaseExportJobRegistry");
  });
});
