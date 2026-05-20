import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createApp } from "../../backend/app";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase69-supabase-worker-startup-gating-boundary.spec.ts",
);
const appPath = path.join(process.cwd(), "backend", "app.ts");
const serverPath = path.join(process.cwd(), "backend", "server.ts");
const backendDependenciesPath = path.join(
  process.cwd(),
  "backend",
  "composition",
  "backendDependencies.ts",
);
const renderWorkerPath = path.join(
  process.cwd(),
  "backend",
  "workers",
  "renderWorker.ts",
);
const renderWorkerStartupPath = path.join(
  process.cwd(),
  "backend",
  "workers",
  "renderWorkerStartup.ts",
);
const harnessPath = path.join(
  process.cwd(),
  "backend",
  "renderer",
  "singleProcessRenderHarness.ts",
);

const ENV_KEYS = [
  "FREE_AI_MIXER_ENABLE_WORKER_STARTUP",
  "FREE_AI_MIXER_ENABLE_WORKER_LOOP",
  "FREE_AI_MIXER_ENABLE_SUPABASE_DB",
  "FREE_AI_MIXER_DB_PROVIDER",
  "FREE_AI_MIXER_SUPABASE_URL",
  "FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
  "FREE_AI_MIXER_SUPABASE_ANON_KEY",
  "FREE_AI_MIXER_DATABASE_URL",
  "FREE_AI_MIXER_PERSISTENCE_ENABLED",
  "FREE_AI_MIXER_PERSISTENCE_FILE_PATH",
  "FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM",
  "FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION",
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

test.describe("phase69 supabase worker startup gating boundary", () => {
  test("createApp builds worker lifecycle while startup and loop remain inert unless separately enabled", async () => {
    await withEnv({}, async () => {
      const app = createApp();
      const lifecycle = app.locals.renderWorkerLifecycle as {
        getStatus: () => {
          initialized: boolean;
          running: boolean;
          startupStatus: {
            startupEnabled: boolean;
            loopRunning: boolean;
            workerId: string;
            pollIntervalMs: number;
          };
        };
        shutdown: () => void;
      };

      const status = lifecycle.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.running).toBe(false);
      expect(status.startupStatus.startupEnabled).toBe(false);
      expect(status.startupStatus.loopRunning).toBe(false);
      expect(status.startupStatus.workerId).toContain("worker-startup-");
      lifecycle.shutdown();
    });

    await withEnv(
      {
        FREE_AI_MIXER_ENABLE_WORKER_STARTUP: "1",
        FREE_AI_MIXER_ENABLE_WORKER_LOOP: "0",
      },
      async () => {
        const app = createApp();
        const lifecycle = app.locals.renderWorkerLifecycle as {
          getStatus: () => {
            initialized: boolean;
            running: boolean;
            startupStatus: {
              startupEnabled: boolean;
              loopRunning: boolean;
            };
          };
          shutdown: () => void;
        };

        const status = lifecycle.getStatus();
        expect(status.initialized).toBe(true);
        expect(status.startupStatus.startupEnabled).toBe(true);
        expect(status.startupStatus.loopRunning).toBe(false);
        expect(status.running).toBe(false);
        lifecycle.shutdown();
      },
    );

    await withEnv(
      {
        FREE_AI_MIXER_ENABLE_SUPABASE_DB: "1",
        FREE_AI_MIXER_DB_PROVIDER: "supabase",
        FREE_AI_MIXER_SUPABASE_URL: "https://example.supabase.co",
        FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
      },
      async () => {
        const app = createApp();
        const lifecycle = app.locals.renderWorkerLifecycle as {
          getStatus: () => {
            initialized: boolean;
            running: boolean;
            startupStatus: {
              startupEnabled: boolean;
              loopRunning: boolean;
            };
          };
          shutdown: () => void;
        };

        const status = lifecycle.getStatus();
        expect(status.initialized).toBe(true);
        expect(status.startupStatus.startupEnabled).toBe(false);
        expect(status.startupStatus.loopRunning).toBe(false);
        expect(status.running).toBe(false);
        expect(
          (app.locals as { renderWorkerLifecycle?: unknown }).renderWorkerLifecycle,
        ).toBeDefined();
        lifecycle.shutdown();
      },
    );
  });

  test("source keeps worker startup gating separate from Supabase registry selection and avoids CLI, secret logging, hardwired rollout, unsupported methods, and signed-url behavior", async () => {
    const [
      specSource,
      appSource,
      serverSource,
      backendDependenciesSource,
      renderWorkerSource,
      renderWorkerStartupSource,
      harnessSource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(appPath),
      readFileSource(serverPath),
      readFileSource(backendDependenciesPath),
      readFileSource(renderWorkerPath),
      readFileSource(renderWorkerStartupPath),
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

    expect(appSource).toContain("createRenderWorkerLifecycle(");
    expect(appSource).toContain("lifecycle.init();");
    expect(appSource).not.toContain("new SupabaseExportJobRegistry");
    expect(appSource).not.toContain(forbiddenSecretLogging);
    expect(appSource).not.toContain("signedUrl");
    expect(appSource).not.toContain("downloadUrl");
    expect(appSource).not.toContain("storage_refs");

    expect(serverSource).toContain("createApp()");
    expect(serverSource).not.toContain("SupabaseExportJobRegistry");
    expect(serverSource).not.toContain(forbiddenSecretLogging);

    expect(backendDependenciesSource).toContain(
      'repositoryComposition.kind === "repository_composition_available"',
    );
    expect(backendDependenciesSource).toContain("new SupabaseExportJobRegistry");
    expect(backendDependenciesSource).not.toContain(
      "FREE_AI_MIXER_ENABLE_WORKER_STARTUP",
    );
    expect(backendDependenciesSource).not.toContain(
      "FREE_AI_MIXER_ENABLE_WORKER_LOOP",
    );

    expect(renderWorkerStartupSource).toContain(
      'FREE_AI_MIXER_ENABLE_WORKER_STARTUP === "1"',
    );
    expect(renderWorkerStartupSource).toContain("loopController.start()");
    expect(renderWorkerStartupSource).not.toContain("SupabaseExportJobRegistry");

    expect(renderWorkerSource).toContain('await registry.getByStatus("submitted")');
    expect(renderWorkerSource).toContain("await executeRenderJob({");
    expect(renderWorkerSource).toContain(
      'FREE_AI_MIXER_ENABLE_WORKER_LOOP === "1"',
    );
    expect(renderWorkerSource).not.toContain("registry.transition(");
    expect(renderWorkerSource).not.toContain("signedUrl");
    expect(renderWorkerSource).not.toContain("downloadUrl");
    expect(renderWorkerSource).not.toContain("storage_refs");
    expect(renderWorkerSource).not.toContain(forbiddenSecretLogging);

    expect(harnessSource).toContain("await input.registry.claim");
    expect(harnessSource).toContain("await input.registry.markRendering");
    expect(harnessSource).toContain("await input.registry.markFinalizing");
    expect(harnessSource).toContain("await input.registry.markSuccess");
    expect(harnessSource).toContain("await input.registry.markError");
    expect(harnessSource).not.toContain("input.registry.transition(");
  });
});
