import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { BackendExportJobRecord } from "../../backend/contracts/exportHttpTypes";
import {
  SupabaseExportJobRegistry,
  type SupabaseExportJobRegistryReadRepository,
} from "../../backend/registry/supabaseExportJobRegistry";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase59-supabase-export-job-registry-claim-adapter.spec.ts",
);
const registryPath = path.join(
  process.cwd(),
  "backend",
  "registry",
  "supabaseExportJobRegistry.ts",
);
const backendDependenciesPath = path.join(
  process.cwd(),
  "backend",
  "composition",
  "backendDependencies.ts",
);
const appPath = path.join(process.cwd(), "backend", "app.ts");
const renderWorkerPath = path.join(
  process.cwd(),
  "backend",
  "workers",
  "renderWorker.ts",
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
  overrides: Partial<BackendExportJobRecord> = {},
): BackendExportJobRecord => ({
  jobId: "job-phase59-default",
  requestId: "request-phase59-default",
  timelineId: "timeline-phase59-default",
  ownerId: "owner-phase59",
  workspaceId: "workspace-phase59",
  status: "submitted",
  attemptCount: 1,
  claimedByWorkerId: "worker-phase59",
  claimExpiresAt: "2026-05-20T12:01:00.000Z",
  startedAt: "2026-05-20T12:00:00.000Z",
  createdAt: "2026-05-20T11:00:00.000Z",
  updatedAt: "2026-05-20T12:00:00.000Z",
  renderSettings: {
    format: "mp4",
    resolution: "720p",
    fps: 24,
    quality: "draft",
  },
  ...overrides,
});

test.describe("phase59 supabase export job registry claim adapter", () => {
  test("claim delegates to repository claimIfAvailable, returns claimed records, throws on non-success results, and keeps lifecycle methods fail-closed", async () => {
    await withUnsetEnv(SUPABASE_ENV_KEYS, async () => {
      const canonicalClaimedRecord = createRecord();
      const claimCalls: Array<{
        jobId: string;
        workerId: string;
        claimTtlMs?: number;
      }> = [];

      const fakeRepository: SupabaseExportJobRegistryReadRepository = {
        createIfAbsent: async (record) => ({
          kind: "created",
          record,
        }),
        claimIfAvailable: async (input) => {
          claimCalls.push(input);

          switch (input.jobId) {
            case "job-phase59-claimed":
              return {
                kind: "claimed",
                record: canonicalClaimedRecord,
              };
            case "job-phase59-not-found":
              return {
                kind: "not_found",
              };
            case "job-phase59-terminal":
              return {
                kind: "not_claimable",
                reason: "terminal",
              };
            case "job-phase59-rendering":
              return {
                kind: "not_claimable",
                reason: "status_not_submitted",
              };
            case "job-phase59-already-claimed":
              return {
                kind: "already_claimed",
                existingRecord: createRecord({
                  jobId: "job-phase59-already-claimed",
                  claimedByWorkerId: "worker-other",
                }),
              };
            default:
              throw new Error(`Unexpected jobId: ${input.jobId}`);
          }
        },
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
        registry.claim("job-phase59-claimed", "worker-phase59", {
          claimTtlMs: 45000,
        }),
      ).resolves.toEqual(canonicalClaimedRecord);

      expect(claimCalls[0]).toEqual({
        jobId: "job-phase59-claimed",
        workerId: "worker-phase59",
        claimTtlMs: 45000,
      });

      await expect(
        registry.claim("job-phase59-not-found", "worker-phase59"),
      ).rejects.toThrow(/Export job 'job-phase59-not-found' was not found\./);

      await expect(
        registry.claim("job-phase59-terminal", "worker-phase59"),
      ).rejects.toThrow(
        /Export job 'job-phase59-terminal' is terminal and cannot be claimed\./,
      );

      await expect(
        registry.claim("job-phase59-rendering", "worker-phase59"),
      ).rejects.toThrow(
        /Export job 'job-phase59-rendering' is not in submitted status and cannot be claimed\./,
      );

      await expect(
        registry.claim("job-phase59-already-claimed", "worker-phase59"),
      ).rejects.toThrow(
        /Export job 'job-phase59-already-claimed' is already claimed by another worker\./,
      );

      await expect(
        registry.markRendering("job-phase59-claimed", "worker-phase59"),
      ).rejects.toThrow(/Method: markRendering\./);
      await expect(
        registry.markFinalizing("job-phase59-claimed", "worker-phase59"),
      ).rejects.toThrow(/Method: markFinalizing\./);
      await expect(
        registry.markSuccess("job-phase59-claimed", "worker-phase59", []),
      ).rejects.toThrow(/Method: markSuccess\./);
      await expect(
        registry.markError("job-phase59-claimed", "worker-phase59", {
          code: "render_failed",
          message: "failure",
        }),
      ).rejects.toThrow(/Method: markError\./);
      await expect(
        registry.transition("job-phase59-claimed", "rendering"),
      ).rejects.toThrow(/Method: transition\./);
    });
  });

  test("source documents adapter-only claim support with no worker or runtime wiring", async () => {
    const [
      specSource,
      registrySource,
      backendDependenciesSource,
      appSource,
      renderWorkerSource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(registryPath),
      readFileSource(backendDependenciesPath),
      readFileSource(appPath),
      readFileSource(renderWorkerPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");

    expect(specSource).toContain("claimIfAvailable");
    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(registrySource).toContain("async claim(");
    expect(registrySource).toContain("claimIfAvailable");
    expect(registrySource).toContain("ExportJobTransitionError");
    expect(registrySource).toContain('throw this.createNotWiredError("markRendering")');
    expect(registrySource).toContain('throw this.createNotWiredError("markFinalizing")');
    expect(registrySource).toContain('throw this.createNotWiredError("markSuccess")');
    expect(registrySource).toContain('throw this.createNotWiredError("markError")');
    expect(registrySource).toContain('throw this.createNotWiredError("transition")');
    expect(registrySource).not.toContain("createClient(");
    expect(registrySource).not.toContain("readSupabaseConfigFromEnv");
    expect(registrySource).not.toContain(forbiddenSecretLogging);
    expect(registrySource).not.toContain(forbiddenSupabaseStart);
    expect(registrySource).not.toContain(forbiddenSupabaseLink);
    expect(registrySource).not.toContain(forbiddenSupabaseDb);

    expect(backendDependenciesSource).not.toContain("SupabaseExportJobRegistry");
    expect(appSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerSource).toContain('await registry.getByStatus("submitted")');
  });
});
