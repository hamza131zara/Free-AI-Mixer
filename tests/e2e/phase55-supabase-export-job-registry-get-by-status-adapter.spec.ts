import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  BackendExportJobRecord,
  BackendExportLifecycleStatus,
} from "../../backend/contracts/exportHttpTypes";
import {
  SupabaseExportJobRegistry,
  type SupabaseExportJobRegistryReadRepository,
} from "../../backend/registry/supabaseExportJobRegistry";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase55-supabase-export-job-registry-get-by-status-adapter.spec.ts",
);
const adapterPath = path.join(
  process.cwd(),
  "backend",
  "registry",
  "supabaseExportJobRegistry.ts",
);
const appPath = path.join(process.cwd(), "backend", "app.ts");
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
const exportsRoutePath = path.join(
  process.cwd(),
  "backend",
  "routes",
  "exports.ts",
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

const createRecord = (
  status: BackendExportLifecycleStatus,
  overrides: Partial<BackendExportJobRecord> = {},
): BackendExportJobRecord => ({
  jobId: "job-phase55-default",
  requestId: "request-phase55-default",
  timelineId: "timeline-phase55-default",
  ownerId: "owner-phase55",
  workspaceId: "workspace-phase55",
  status,
  attemptCount: 0,
  createdAt: "2026-05-19T16:30:40.071Z",
  updatedAt: "2026-05-19T16:30:40.071Z",
  renderSettings: {
    format: "mp4",
    resolution: "720p",
    fps: 24,
    quality: "draft",
  },
  ...overrides,
});

test.describe("phase55 supabase export job registry getByStatus adapter", () => {
  test("getByStatus delegates to listByStatus for submitted and non-submitted statuses while blocked lifecycle methods remain fail-closed", async () => {
    await withUnsetEnv(SUPABASE_ENV_KEYS, async () => {
      const calls: string[] = [];
      const submittedJobs = [
        createRecord("submitted", { jobId: "job-phase55-submitted-a" }),
        createRecord("submitted", { jobId: "job-phase55-submitted-b" }),
      ];
      const successJobs = [
        createRecord("success", {
          jobId: "job-phase55-success-a",
          completedAt: "2026-05-19T16:45:00.000Z",
        }),
      ];

      const fakeRepository: SupabaseExportJobRegistryReadRepository = {
        createIfAbsent: async (candidate) => ({
          kind: "created",
          record: candidate,
        }),
        listByStatus: async (status) => {
          calls.push(`listByStatus:${status}`);
          if (status === "submitted") {
            return submittedJobs;
          }
          if (status === "success") {
            return successJobs;
          }
          return [];
        },
        getByJobId: async () => undefined,
        getByIdempotencyScope: async () => undefined,
      };

      const registry = new SupabaseExportJobRegistry({
        dependencies: {
          jobsRepository: fakeRepository,
        },
      });

      await expect(registry.getByStatus("submitted")).resolves.toBe(submittedJobs);
      await expect(registry.getByStatus("success")).resolves.toBe(successJobs);
      await expect(registry.getByStatus("error")).resolves.toEqual([]);
      expect(calls).toEqual([
        "listByStatus:submitted",
        "listByStatus:success",
        "listByStatus:error",
      ]);

      const expectedErrorPattern =
        /SupabaseExportJobRegistry is a boundary scaffold only and is not wired for runtime DB persistence yet\./;

      await expect(registry.claim("job-phase55", "worker-phase55")).rejects.toThrow(
        expectedErrorPattern,
      );
      await expect(
        registry.markRendering("job-phase55", "worker-phase55"),
      ).rejects.toThrow(expectedErrorPattern);
      await expect(
        registry.markFinalizing("job-phase55", "worker-phase55"),
      ).rejects.toThrow(expectedErrorPattern);
      await expect(
        registry.markSuccess("job-phase55", "worker-phase55", []),
      ).rejects.toThrow(expectedErrorPattern);
      await expect(
        registry.markError("job-phase55", "worker-phase55", { message: "failure" }),
      ).rejects.toThrow(expectedErrorPattern);
      await expect(registry.transition("job-phase55", "rendering")).rejects.toThrow(
        expectedErrorPattern,
      );
    });
  });

  test("source proves adapter-only getByStatus wiring and no worker/runtime activation", async () => {
    const [
      specSource,
      adapterSource,
      appSource,
      backendDependenciesSource,
      renderWorkerSource,
      exportsRouteSource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(adapterPath),
      readFileSource(appPath),
      readFileSource(backendDependenciesPath),
      readFileSource(renderWorkerPath),
      readFileSource(exportsRoutePath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");

    expect(specSource).toContain("listByStatus");
    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(adapterSource).toContain("async getByStatus(");
    expect(adapterSource).toContain("jobsRepository.listByStatus(status)");
    expect(adapterSource).not.toContain("limit(");
    expect(adapterSource).not.toContain("order(");
    expect(adapterSource).toContain('throw this.createNotWiredError("claim")');
    expect(adapterSource).toContain('throw this.createNotWiredError("markRendering")');
    expect(adapterSource).toContain('throw this.createNotWiredError("markFinalizing")');
    expect(adapterSource).toContain('throw this.createNotWiredError("markSuccess")');
    expect(adapterSource).toContain('throw this.createNotWiredError("markError")');
    expect(adapterSource).toContain('throw this.createNotWiredError("transition")');
    expect(adapterSource).not.toContain("createClient(");
    expect(adapterSource).not.toContain("readSupabaseConfigFromEnv");
    expect(adapterSource).not.toContain(forbiddenSecretLogging);
    expect(adapterSource).not.toContain(forbiddenSupabaseStart);
    expect(adapterSource).not.toContain(forbiddenSupabaseLink);
    expect(adapterSource).not.toContain(forbiddenSupabaseDb);

    expect(appSource).not.toContain("SupabaseExportJobRegistry");
    expect(backendDependenciesSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerSource).toContain('await registry.getByStatus("submitted")');
    expect(renderWorkerSource).not.toContain("SupabaseExportJobRegistry");
    expect(exportsRouteSource).not.toContain("SupabaseExportJobRegistry");
  });
});
