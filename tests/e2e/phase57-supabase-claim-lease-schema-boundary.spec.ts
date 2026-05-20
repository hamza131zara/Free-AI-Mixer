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
  "phase57-supabase-claim-lease-schema-boundary.spec.ts",
);
const migrationSchemaPath = path.join(
  process.cwd(),
  "backend",
  "db",
  "migrations",
  "0001_initial_supabase_postgres_schema.sql",
);
const draftSchemaPath = path.join(
  process.cwd(),
  "backend",
  "db",
  "schema",
  "phase26-initial-supabase-postgres-schema.sql",
);
const registryPath = path.join(
  process.cwd(),
  "backend",
  "registry",
  "supabaseExportJobRegistry.ts",
);
const repositoryContractsPath = path.join(
  process.cwd(),
  "backend",
  "repositories",
  "repositoryContracts.ts",
);
const repositoryPath = path.join(
  process.cwd(),
  "backend",
  "repositories",
  "supabaseExportJobsRepository.ts",
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

test.describe("phase57 supabase claim lease schema boundary", () => {
  test("claim remains fail-closed after schema draft preparation", async () => {
    await withUnsetEnv(SUPABASE_ENV_KEYS, async () => {
      const fakeRepository: SupabaseExportJobRegistryReadRepository = {
        createIfAbsent: async (record) => ({
          kind: "created",
          record,
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
        registry.claim("job-phase57", "worker-phase57", { claimTtlMs: 60000 }),
      ).rejects.toThrow(
        /SupabaseExportJobRegistry is a boundary scaffold only and is not wired for runtime DB persistence yet\./,
      );
    });
  });

  test("source proves claim lease schema fields and repository claim support exist while registry claim implementation and runtime wiring remain deferred", async () => {
    const [
      specSource,
      migrationSchemaSource,
      draftSchemaSource,
      registrySource,
      repositoryContractsSource,
      repositorySource,
      renderWorkerSource,
      harnessSource,
      backendDependenciesSource,
      appSource,
      repositoryCompositionSource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(migrationSchemaPath),
      readFileSource(draftSchemaPath),
      readFileSource(registryPath),
      readFileSource(repositoryContractsPath),
      readFileSource(repositoryPath),
      readFileSource(renderWorkerPath),
      readFileSource(harnessPath),
      readFileSource(backendDependenciesPath),
      readFileSource(appPath),
      readFileSource(repositoryCompositionPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");

    for (const source of [specSource, registrySource, repositorySource]) {
      expect(source).not.toContain(forbiddenSecretLogging);
      expect(source).not.toContain(forbiddenSupabaseStart);
      expect(source).not.toContain(forbiddenSupabaseLink);
      expect(source).not.toContain(forbiddenSupabaseDb);
    }

    for (const schemaSource of [migrationSchemaSource, draftSchemaSource]) {
      expect(schemaSource).toContain("create table if not exists export_jobs");
      expect(schemaSource).toContain("claimed_by_worker_id text");
      expect(schemaSource).toContain("claim_expires_at timestamptz");
      expect(schemaSource).toContain("row_version bigint not null default 0");
      expect(schemaSource).toContain(
        "create index if not exists export_jobs_status_submitted_created_job_idx",
      );
      expect(schemaSource).toContain(
        "on export_jobs (status, submitted_at, created_at, job_id);",
      );
      expect(schemaSource).toContain(
        "create index if not exists export_jobs_status_claim_expires_idx",
      );
      expect(schemaSource).toContain(
        "on export_jobs (status, claim_expires_at);",
      );
      expect(schemaSource).toContain(
        "create index if not exists export_jobs_claimed_by_worker_expires_idx",
      );
      expect(schemaSource).toContain(
        "on export_jobs (claimed_by_worker_id, claim_expires_at);",
      );
    }

    expect(registrySource).toContain("async claim(");
    expect(registrySource).toContain('throw this.createNotWiredError("claim")');
    expect(registrySource).toContain("worker claim/TTL semantics");
    expect(registrySource).not.toContain("claimIfAvailable");

    expect(repositoryContractsSource).toContain("BackendExportJobClaimInput");
    expect(repositoryContractsSource).toContain("BackendExportJobClaimResult");
    expect(repositoryContractsSource).toContain("claimIfAvailable(");
    expect(repositorySource).toContain("async claimIfAvailable(");
    expect(repositorySource).toContain("claimed_by_worker_id");
    expect(repositorySource).toContain("claim_expires_at");
    expect(repositorySource).toContain("row_version");

    expect(renderWorkerSource).toContain('await registry.getByStatus("submitted")');
    expect(renderWorkerSource).not.toContain("SupabaseExportJobRegistry");

    expect(harnessSource).toContain("await input.registry.claim");
    expect(harnessSource).toContain("await input.registry.markRendering");
    expect(harnessSource).toContain("await input.registry.markFinalizing");
    expect(harnessSource).toContain("await input.registry.markSuccess");
    expect(harnessSource).toContain("await input.registry.markError");
    expect(harnessSource).not.toContain("SupabaseExportJobRegistry");

    expect(backendDependenciesSource).toContain("new InMemoryExportJobRegistry()");
    expect(backendDependenciesSource).not.toContain("SupabaseExportJobRegistry");
    expect(appSource).not.toContain("SupabaseExportJobRegistry");
    expect(repositoryCompositionSource).not.toContain("SupabaseExportJobRegistry");
  });
});
