import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  SupabaseExportJobRegistry,
  type SupabaseExportJobRegistryReadRepository,
} from "../../backend/registry/supabaseExportJobRegistry";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase56-supabase-worker-claim-lease-boundary.spec.ts",
);
const registryPath = path.join(
  process.cwd(),
  "backend",
  "registry",
  "supabaseExportJobRegistry.ts",
);
const exportJobRegistryPath = path.join(
  process.cwd(),
  "backend",
  "registry",
  "exportJobRegistry.ts",
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
const appPath = path.join(process.cwd(), "backend", "app.ts");
const repositoryCompositionPath = path.join(
  process.cwd(),
  "backend",
  "composition",
  "repositoryComposition.ts",
);
const repositoryContractsPath = path.join(
  process.cwd(),
  "backend",
  "repositories",
  "repositoryContracts.ts",
);
const schemaPath = path.join(
  process.cwd(),
  "backend",
  "db",
  "migrations",
  "0001_initial_supabase_postgres_schema.sql",
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

test.describe("phase56 supabase worker claim lease boundary", () => {
  test("claim uses repository claim support while worker/runtime wiring still remains deferred", async () => {
    await withUnsetEnv(SUPABASE_ENV_KEYS, async () => {
      const fakeRepository: SupabaseExportJobRegistryReadRepository = {
        createIfAbsent: async (record) => ({
          kind: "created",
          record,
        }),
        claimIfAvailable: async () => ({
          kind: "not_claimable",
          reason: "status_not_submitted",
        }),
        transitionIfOwned: async () => ({
  kind: "not_found",
}),
        listByStatus: async () => [],
        getByJobId: async () => undefined,
        getByIdempotencyScope: async () => undefined,
      };

      const registry = new SupabaseExportJobRegistry({
        dependencies: {
          jobsRepository: fakeRepository,
        },
      });

      await expect(
        registry.claim("job-phase56", "worker-phase56", { claimTtlMs: 30000 }),
      ).rejects.toThrow(
        /Export job 'job-phase56' is not in submitted status and cannot be claimed\./,
      );
    });
  });

  test("source proves worker claim and lease behavior remain deferred even after schema draft support is added", async () => {
    const [
      specSource,
      registrySource,
      exportJobRegistrySource,
      renderWorkerSource,
      harnessSource,
      backendDependenciesSource,
      appSource,
      repositoryCompositionSource,
      repositoryContractsSource,
      schemaSource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(registryPath),
      readFileSource(exportJobRegistryPath),
      readFileSource(renderWorkerPath),
      readFileSource(harnessPath),
      readFileSource(backendDependenciesPath),
      readFileSource(appPath),
      readFileSource(repositoryCompositionPath),
      readFileSource(repositoryContractsPath),
      readFileSource(schemaPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");

    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(exportJobRegistrySource).toContain("claimTtlMs?: number");
    expect(exportJobRegistrySource).toContain("claim(");

    expect(registrySource).toContain("async claim(");
    expect(registrySource).toContain("claimIfAvailable");
    expect(registrySource).toContain("ExportJobTransitionError");
    expect(registrySource).toContain("worker claim/TTL semantics");
    expect(registrySource).not.toContain("claimed_by_worker_id");
    expect(registrySource).not.toContain("claim_expires_at");
    expect(registrySource).not.toContain("createClient(");
    expect(registrySource).not.toContain("readSupabaseConfigFromEnv");
    expect(registrySource).not.toContain(forbiddenSecretLogging);
    expect(registrySource).not.toContain(forbiddenSupabaseStart);
    expect(registrySource).not.toContain(forbiddenSupabaseLink);
    expect(registrySource).not.toContain(forbiddenSupabaseDb);

    expect(schemaSource).toContain("create table if not exists export_jobs");
    expect(schemaSource).toContain("claimed_by_worker_id text");
    expect(schemaSource).toContain("claim_expires_at timestamptz");
    expect(schemaSource).toContain("row_version bigint not null default 0");

    expect(repositoryContractsSource).toContain("BackendExportJobClaimInput");
expect(repositoryContractsSource).toContain("BackendExportJobClaimResult");
expect(repositoryContractsSource).toContain("claimIfAvailable(");

    expect(renderWorkerSource).toContain('await registry.getByStatus("submitted")');
    expect(renderWorkerSource).not.toContain("SupabaseExportJobRegistry");

    expect(harnessSource).toContain("await input.registry.claim");
    expect(harnessSource).toContain("await input.registry.markRendering");
    expect(harnessSource).toContain("await input.registry.markFinalizing");
    expect(harnessSource).toContain("await input.registry.markSuccess");
    expect(harnessSource).toContain("await input.registry.markError");
    expect(harnessSource).toContain("Failed to claim export job.");
    expect(harnessSource).not.toContain("SupabaseExportJobRegistry");

    expect(backendDependenciesSource).toContain("new InMemoryExportJobRegistry()");
    expect(backendDependenciesSource).not.toContain("SupabaseExportJobRegistry");
    expect(backendDependenciesSource).not.toContain("createSupabaseExportJobRegistry");

    expect(appSource).toContain(
      "createExportRouter(backendDeps.registry, exportRouterOptions)",
    );
    expect(appSource).not.toContain("SupabaseExportJobRegistry");

    expect(repositoryCompositionSource).toContain("createSupabaseExportJobsRepository");
    expect(repositoryCompositionSource).not.toContain("SupabaseExportJobRegistry");
  });
});
