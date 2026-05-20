import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createBackendDependencies } from "../../backend/composition/backendDependencies";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase64-supabase-runtime-registry-wiring-boundary.spec.ts",
);
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
const routesPath = path.join(process.cwd(), "backend", "routes", "exports.ts");
const renderWorkerPath = path.join(
  process.cwd(),
  "backend",
  "workers",
  "renderWorker.ts",
);
const registryPath = path.join(
  process.cwd(),
  "backend",
  "registry",
  "supabaseExportJobRegistry.ts",
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

const withEnv = async (
  values: Partial<Record<(typeof SUPABASE_ENV_KEYS)[number], string>>,
  run: () => Promise<void>,
): Promise<void> => {
  const previous = new Map<string, string | undefined>();

  for (const key of SUPABASE_ENV_KEYS) {
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
    for (const key of SUPABASE_ENV_KEYS) {
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

test.describe("phase64 supabase runtime registry wiring boundary", () => {
  test("createBackendDependencies stays local by default and selects SupabaseExportJobRegistry only when Supabase config is enabled and valid", async () => {
    await withEnv({}, async () => {
      const backendDependencies = createBackendDependencies();

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
    });

    await withEnv(
      {
        FREE_AI_MIXER_ENABLE_SUPABASE_DB: "1",
        FREE_AI_MIXER_DB_PROVIDER: "supabase",
        FREE_AI_MIXER_SUPABASE_URL: "https://example.supabase.co",
        FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
      },
      async () => {
        const backendDependencies = createBackendDependencies();

        expect(backendDependencies.repositoryComposition.kind).toBe(
          "repository_composition_available",
        );
        expect(backendDependencies.repositoryComposition.dbBacked).toBe(true);
        expect(backendDependencies.repositoryComposition.enabled).toBe(true);
        expect(backendDependencies.repositoryComposition.valid).toBe(true);

        expect(backendDependencies.registry.constructor.name).toBe(
          "SupabaseExportJobRegistry",
        );
        expect(
          (backendDependencies.registry as { kind?: string }).kind,
        ).toBe("supabase_export_job_registry");
      },
    );
  });

  test("source keeps runtime wiring env-gated in backendDependencies only, uses repository composition, leaves worker activation unchanged, and adds no signed-url behavior", async () => {
    const [
      specSource,
      backendDependenciesSource,
      repositoryCompositionSource,
      routesSource,
      renderWorkerSource,
      registrySource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(backendDependenciesPath),
      readFileSource(repositoryCompositionPath),
      readFileSource(routesPath),
      readFileSource(renderWorkerPath),
      readFileSource(registryPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");

    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(backendDependenciesSource).toContain("repositoryComposition.kind === \"repository_composition_available\"");
    expect(backendDependenciesSource).toContain("new SupabaseExportJobRegistry");
    expect(backendDependenciesSource).toContain("repositoryComposition.createRepositories().exportJobsRepository");
    expect(backendDependenciesSource).toContain("new JsonFileExportJobRegistry");
    expect(backendDependenciesSource).toContain("new InMemoryExportJobRegistry");
    expect(backendDependenciesSource).not.toContain(forbiddenSecretLogging);
    expect(backendDependenciesSource).not.toContain("signedUrl");
    expect(backendDependenciesSource).not.toContain("downloadUrl");
    expect(backendDependenciesSource).not.toContain("storage_refs");

    expect(repositoryCompositionSource).toContain("createSupabaseExportJobsRepository");
    expect(repositoryCompositionSource).not.toContain("SupabaseExportJobRegistry");

    expect(routesSource).toContain("FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION === \"1\"");
    expect(routesSource).not.toContain("SupabaseExportJobRegistry");

    expect(renderWorkerSource).toContain("FREE_AI_MIXER_ENABLE_WORKER_LOOP === \"1\"");
    expect(renderWorkerSource).not.toContain("SupabaseExportJobRegistry");

    expect(registrySource).toContain("async markSuccess(");
    expect(registrySource).toContain("validateArtifactMetadata");
    expect(registrySource).toContain("markSuccessIfOwned");
    expect(registrySource).toContain('throw this.createNotWiredError("transition")');
    expect(registrySource).not.toContain("signedUrl");
    expect(registrySource).not.toContain("downloadUrl");
    expect(registrySource).not.toContain("storage_refs");
  });
});
