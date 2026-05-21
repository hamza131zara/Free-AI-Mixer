import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readSupabaseConfigFromEnv } from "../../backend/config/supabaseConfig";
import { createSupabaseClientFactory } from "../../backend/db/supabaseClientFactory";
import { createBackendDependencies } from "../../backend/composition/backendDependencies";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase73-supabase-remote-smoke-readiness-pack.spec.ts",
);
const remoteConnectionSmokePath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase42-remote-supabase-connection-smoke.spec.ts",
);
const remoteAccountWorkspaceSmokePath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase43-remote-account-workspace-repository-smoke.spec.ts",
);
const remoteExportJobsSmokePath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase44-remote-export-jobs-repository-smoke.spec.ts",
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
const supabaseConfigPath = path.join(
  process.cwd(),
  "backend",
  "config",
  "supabaseConfig.ts",
);
const clientFactoryPath = path.join(
  process.cwd(),
  "backend",
  "db",
  "supabaseClientFactory.ts",
);
const renderWorkerPath = path.join(
  process.cwd(),
  "backend",
  "workers",
  "renderWorker.ts",
);

const ENV_KEYS = [
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
  "FREE_AI_MIXER_ENABLE_WORKER_STARTUP",
  "FREE_AI_MIXER_ENABLE_WORKER_LOOP",
] as const;

const readFileSource = async (filePath: string): Promise<string> =>
  fs.readFile(filePath, "utf8");

const withEnv = async (
  values: Partial<Record<(typeof ENV_KEYS)[number], string>>,
  run: () => Promise<void>,
): Promise<void> => {
  const previous = new Map<string, string | undefined>();

  for (const key of ENV_KEYS) {
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
    for (const key of ENV_KEYS) {
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

test.describe("phase73 supabase remote smoke readiness pack", () => {
  test("default runs stay offline and incomplete opt-in remote env falls back safely without leaking secrets", async () => {
    await withEnv({}, async () => {
      const config = readSupabaseConfigFromEnv(process.env);
      const factoryResult = createSupabaseClientFactory(config);
      const backendDependencies = createBackendDependencies();

      expect(config.enabled).toBe(false);
      expect(config.valid).toBe(true);
      expect(factoryResult.kind).toBe("supabase_client_unavailable");
      expect(backendDependencies.registry.constructor.name).toBe(
        "InMemoryExportJobRegistry",
      );
      expect(backendDependencies.repositoryComposition.kind).toBe(
        "repository_composition_disabled",
      );
      expect(backendDependencies.repositoryComposition.reason).toBe("disabled");
    });

    await withEnv(
      {
        FREE_AI_MIXER_RUN_REMOTE_SUPABASE_SMOKE: "1",
        FREE_AI_MIXER_RUN_REMOTE_ACCOUNT_WORKSPACE_REPOSITORY_SMOKE: "1",
        FREE_AI_MIXER_RUN_REMOTE_EXPORT_JOBS_REPOSITORY_SMOKE: "1",
      },
      async () => {
        const config = readSupabaseConfigFromEnv(process.env);
        const factoryResult = createSupabaseClientFactory(config);
        const backendDependencies = createBackendDependencies();

        expect(config.enabled).toBe(false);
        expect(factoryResult.kind).toBe("supabase_client_unavailable");
        expect(backendDependencies.registry.constructor.name).toBe(
          "InMemoryExportJobRegistry",
        );
        expect(backendDependencies.repositoryComposition.kind).toBe(
          "repository_composition_disabled",
        );
        expect(backendDependencies.repositoryComposition.reason).toBe("disabled");
      },
    );

    await withEnv(
      {
        FREE_AI_MIXER_RUN_REMOTE_SUPABASE_SMOKE: "1",
        FREE_AI_MIXER_ENABLE_SUPABASE_DB: "1",
        FREE_AI_MIXER_DB_PROVIDER: "supabase",
        FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY: "phase73-secret-key",
      },
      async () => {
        const config = readSupabaseConfigFromEnv(process.env);
        const factoryResult = createSupabaseClientFactory(config);
        const backendDependencies = createBackendDependencies();
        const serializedFactoryResult = JSON.stringify(factoryResult);

        expect(config.enabled).toBe(true);
        expect(config.valid).toBe(false);
        expect(factoryResult.kind).toBe("supabase_client_unavailable");
        expect(factoryResult.reason).toBe("invalid_config");
        expect(factoryResult.publicConfig.enabled).toBe(true);
        expect(factoryResult.publicConfig.valid).toBe(false);
        expect("serviceRoleKey" in factoryResult.publicConfig).toBe(false);
        expect(serializedFactoryResult).not.toContain("phase73-secret-key");
        expect(backendDependencies.registry.constructor.name).toBe(
          "InMemoryExportJobRegistry",
        );
        expect(backendDependencies.repositoryComposition.kind).toBe(
          "repository_composition_disabled",
        );
        expect(backendDependencies.repositoryComposition.reason).toBe(
          "invalid_config",
        );
      },
    );
  });

  test("source keeps remote readiness opt-in only, avoids secret logging and CLI usage, and does not imply worker activation or signed/download/storage URL behavior", async () => {
    const [
      specSource,
      remoteConnectionSmokeSource,
      remoteAccountWorkspaceSmokeSource,
      remoteExportJobsSmokeSource,
      backendDependenciesSource,
      repositoryCompositionSource,
      supabaseConfigSource,
      clientFactorySource,
      renderWorkerSource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(remoteConnectionSmokePath),
      readFileSource(remoteAccountWorkspaceSmokePath),
      readFileSource(remoteExportJobsSmokePath),
      readFileSource(backendDependenciesPath),
      readFileSource(repositoryCompositionPath),
      readFileSource(supabaseConfigPath),
      readFileSource(clientFactoryPath),
      readFileSource(renderWorkerPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");

    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(remoteConnectionSmokeSource).toContain(
      'const OPT_IN_ENV = "FREE_AI_MIXER_RUN_REMOTE_SUPABASE_SMOKE"',
    );
    expect(remoteConnectionSmokeSource).toContain("test.skip(");
    expect(remoteConnectionSmokeSource).toContain("sanitizeSupabaseErrorMessage");
    expect(remoteConnectionSmokeSource).not.toContain(forbiddenSecretLogging);

    expect(remoteAccountWorkspaceSmokeSource).toContain(
      'const OPT_IN_ENV = "FREE_AI_MIXER_RUN_REMOTE_ACCOUNT_WORKSPACE_REPOSITORY_SMOKE"',
    );
    expect(remoteAccountWorkspaceSmokeSource).toContain("test.skip(");
    expect(remoteAccountWorkspaceSmokeSource).not.toContain(forbiddenSecretLogging);

    expect(remoteExportJobsSmokeSource).toContain(
      'const OPT_IN_ENV = "FREE_AI_MIXER_RUN_REMOTE_EXPORT_JOBS_REPOSITORY_SMOKE"',
    );
    expect(remoteExportJobsSmokeSource).toContain("test.skip(");
    expect(remoteExportJobsSmokeSource).not.toContain(forbiddenSecretLogging);

    expect(supabaseConfigSource).toContain("VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY");
    expect(supabaseConfigSource).toContain("must not be used for backend Supabase configuration");
    expect(supabaseConfigSource).not.toContain(forbiddenSecretLogging);

    expect(clientFactorySource).toContain("createClient(");
    expect(clientFactorySource).not.toContain(forbiddenSecretLogging);
    expect(clientFactorySource).not.toContain(forbiddenSupabaseStart);
    expect(clientFactorySource).not.toContain(forbiddenSupabaseLink);
    expect(clientFactorySource).not.toContain(forbiddenSupabaseDb);

    expect(backendDependenciesSource).toContain(
      'repositoryComposition.kind === "repository_composition_available"',
    );
    expect(backendDependenciesSource).not.toContain(
      "FREE_AI_MIXER_RUN_REMOTE_SUPABASE_SMOKE",
    );
    expect(backendDependenciesSource).not.toContain(
      "FREE_AI_MIXER_RUN_REMOTE_ACCOUNT_WORKSPACE_REPOSITORY_SMOKE",
    );
    expect(backendDependenciesSource).not.toContain(
      "FREE_AI_MIXER_RUN_REMOTE_EXPORT_JOBS_REPOSITORY_SMOKE",
    );
    expect(backendDependenciesSource).not.toContain(forbiddenSecretLogging);
    expect(backendDependenciesSource).not.toContain("signedUrl");
    expect(backendDependenciesSource).not.toContain("downloadUrl");
    expect(backendDependenciesSource).not.toContain("storage_refs");

    expect(repositoryCompositionSource).toContain(
      'return toDisabledRepositoryComposition(config, "invalid_config")',
    );
    expect(renderWorkerSource).toContain(
      'FREE_AI_MIXER_ENABLE_WORKER_LOOP === "1"',
    );
    expect(renderWorkerSource).not.toContain("FREE_AI_MIXER_RUN_REMOTE_SUPABASE_SMOKE");
  });
});
