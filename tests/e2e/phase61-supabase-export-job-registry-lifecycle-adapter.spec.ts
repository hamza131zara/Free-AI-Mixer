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
  "phase61-supabase-export-job-registry-lifecycle-adapter.spec.ts",
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
  jobId: "job-phase61-default",
  requestId: "request-phase61-default",
  timelineId: "timeline-phase61-default",
  ownerId: "owner-phase61",
  workspaceId: "workspace-phase61",
  status: "rendering",
  attemptCount: 1,
  claimedByWorkerId: "worker-phase61",
  claimExpiresAt: "2026-05-20T12:30:00.000Z",
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

test.describe("phase61 supabase export job registry lifecycle adapter", () => {
  test("markRendering, markFinalizing, and markError delegate to transitionIfOwned, support finalizing fallback, and throw on non-success results while keeping generic transition fail-closed", async () => {
    await withUnsetEnv(SUPABASE_ENV_KEYS, async () => {
      const renderingRecord = createRecord({
        jobId: "job-phase61-rendering",
        status: "rendering",
      });
      const finalizingRecord = createRecord({
        jobId: "job-phase61-finalizing",
        status: "finalizing",
        completedAt: "2026-05-20T12:05:00.000Z",
        finalizingAt: "2026-05-20T12:05:00.000Z",
      });
      const errorFromRenderingRecord = createRecord({
        jobId: "job-phase61-error-rendering",
        status: "error",
        completedAt: "2026-05-20T12:10:00.000Z",
        failure: {
          code: "render_failed",
          message: "Renderer failed.",
        },
      });
      const errorFromFinalizingRecord = createRecord({
        jobId: "job-phase61-error-finalizing",
        status: "error",
        completedAt: "2026-05-20T12:10:00.000Z",
        failure: {
          code: "finalize_failed",
          message: "Finalize failed.",
        },
      });

      const transitionCalls: Array<{
        jobId: string;
        workerId: string;
        expectedCurrentStatus: string;
        nextStatus: string;
        failureCode?: string;
        failureMessage?: string;
      }> = [];

      const fakeRepository: SupabaseExportJobRegistryReadRepository = {
        createIfAbsent: async (record) => ({
          kind: "created",
          record,
        }),
        claimIfAvailable: async () => ({
          kind: "not_found",
        }),
        transitionIfOwned: async (input) => {
          transitionCalls.push(input);

          switch (input.jobId) {
            case "job-phase61-rendering":
              return {
                kind: "transitioned",
                record: renderingRecord,
              };
            case "job-phase61-finalizing":
              return {
                kind: "transitioned",
                record: finalizingRecord,
              };
            case "job-phase61-error-rendering":
              return {
                kind: "transitioned",
                record: errorFromRenderingRecord,
              };
            case "job-phase61-error-finalizing":
              return input.expectedCurrentStatus === "rendering"
                ? {
                    kind: "not_transitionable",
                    reason: "status_mismatch",
                  }
                : {
                    kind: "transitioned",
                    record: errorFromFinalizingRecord,
                  };
            case "job-phase61-not-found":
              return {
                kind: "not_found",
              };
            case "job-phase61-not-owned":
              return {
                kind: "not_owned",
              };
            case "job-phase61-claim-expired":
              return {
                kind: "claim_expired",
              };
            case "job-phase61-not-transitionable":
              return {
                kind: "not_transitionable",
                reason: "invalid_transition",
              };
            case "job-phase61-version-conflict":
              return {
                kind: "version_conflict",
                existingRecord: createRecord({
                  jobId: "job-phase61-version-conflict",
                  updatedAt: "2026-05-20T12:09:00.000Z",
                }),
              };
            default:
              throw new Error(`Unexpected jobId: ${input.jobId}`);
          }
        },
        listByStatus: async () => [],
        getByJobId: async () => undefined,
        getByIdempotencyScope: async () => undefined,
        markSuccessIfOwned: async () => ({
          kind: "not_found",
        }),
      };

      const registry = new SupabaseExportJobRegistry({
        dependencies: {
          jobsRepository: fakeRepository,
        },
      });

      await expect(
        registry.markRendering("job-phase61-rendering", "worker-phase61"),
      ).resolves.toEqual(renderingRecord);

      await expect(
        registry.markFinalizing("job-phase61-finalizing", "worker-phase61"),
      ).resolves.toEqual(finalizingRecord);

      await expect(
        registry.markError("job-phase61-error-rendering", "worker-phase61", {
          code: "render_failed",
          message: "Renderer failed.",
        }),
      ).resolves.toEqual(errorFromRenderingRecord);

      await expect(
        registry.markError("job-phase61-error-finalizing", "worker-phase61", {
          code: "finalize_failed",
          message: "Finalize failed.",
        }),
      ).resolves.toEqual(errorFromFinalizingRecord);

      expect(transitionCalls).toEqual([
        {
          jobId: "job-phase61-rendering",
          workerId: "worker-phase61",
          expectedCurrentStatus: "submitted",
          nextStatus: "rendering",
        },
        {
          jobId: "job-phase61-finalizing",
          workerId: "worker-phase61",
          expectedCurrentStatus: "rendering",
          nextStatus: "finalizing",
        },
        {
          jobId: "job-phase61-error-rendering",
          workerId: "worker-phase61",
          expectedCurrentStatus: "rendering",
          nextStatus: "error",
          failureCode: "render_failed",
          failureMessage: "Renderer failed.",
        },
        {
          jobId: "job-phase61-error-finalizing",
          workerId: "worker-phase61",
          expectedCurrentStatus: "rendering",
          nextStatus: "error",
          failureCode: "finalize_failed",
          failureMessage: "Finalize failed.",
        },
        {
          jobId: "job-phase61-error-finalizing",
          workerId: "worker-phase61",
          expectedCurrentStatus: "finalizing",
          nextStatus: "error",
          failureCode: "finalize_failed",
          failureMessage: "Finalize failed.",
        },
      ]);

      await expect(
        registry.markRendering("job-phase61-not-found", "worker-phase61"),
      ).rejects.toThrow(/Export job 'job-phase61-not-found' was not found\./);

      await expect(
        registry.markRendering("job-phase61-not-owned", "worker-phase61"),
      ).rejects.toThrow(
        /Worker does not own export job 'job-phase61-not-owned'\./,
      );

      await expect(
        registry.markRendering("job-phase61-claim-expired", "worker-phase61"),
      ).rejects.toThrow(
        /Export job 'job-phase61-claim-expired' claim has expired\./,
      );

      await expect(
        registry.markRendering("job-phase61-not-transitionable", "worker-phase61"),
      ).rejects.toThrow(
        /Transition to 'rendering' is not allowed for export job 'job-phase61-not-transitionable'\./,
      );

      await expect(
        registry.markRendering("job-phase61-version-conflict", "worker-phase61"),
      ).rejects.toThrow(
        /Export job 'job-phase61-version-conflict' changed before transition to 'rendering' could be applied\./,
      );

      await expect(
        registry.transition("job-phase61-rendering", "rendering"),
      ).rejects.toThrow(/Method: transition\./);
    });
  });

  test("source documents adapter-only lifecycle support with no worker or runtime wiring", async () => {
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

    expect(specSource).toContain("transitionIfOwned");
    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(registrySource).toContain("async markRendering(");
    expect(registrySource).toContain("async markFinalizing(");
    expect(registrySource).toContain("async markError(");
    expect(registrySource).toContain("transitionIfOwned");
    expect(registrySource).toContain("async markSuccess(");
    expect(registrySource).toContain("validateArtifactMetadata");
    expect(registrySource).toContain("markSuccessIfOwned");
    expect(registrySource).toContain('throw this.createNotWiredError("transition")');
    expect(registrySource).toContain("ExportJobTransitionError");
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
