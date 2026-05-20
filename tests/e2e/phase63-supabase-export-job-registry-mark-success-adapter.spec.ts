import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { BackendArtifactMetadata, BackendExportJobRecord } from "../../backend/contracts/exportHttpTypes";
import {
  SupabaseExportJobRegistry,
  type SupabaseExportJobRegistryReadRepository,
} from "../../backend/registry/supabaseExportJobRegistry";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase63-supabase-export-job-registry-mark-success-adapter.spec.ts",
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
  jobId: "job-phase63-default",
  requestId: "request-phase63-default",
  timelineId: "timeline-phase63-default",
  ownerId: "owner-phase63",
  workspaceId: "workspace-phase63",
  status: "success",
  attemptCount: 1,
  claimedByWorkerId: "worker-phase63",
  claimExpiresAt: "2026-05-20T12:30:00.000Z",
  startedAt: "2026-05-20T12:00:00.000Z",
  createdAt: "2026-05-20T11:00:00.000Z",
  updatedAt: "2026-05-20T12:10:00.000Z",
  completedAt: "2026-05-20T12:10:00.000Z",
  renderSettings: {
    format: "mp4",
    resolution: "720p",
    fps: 24,
    quality: "draft",
  },
  ...overrides,
});

test.describe("phase63 supabase export job registry markSuccess adapter", () => {
  test("markSuccess validates artifact metadata, delegates to markSuccessIfOwned, returns succeeded records, and throws on non-success results while generic transition stays fail-closed", async () => {
    await withUnsetEnv(SUPABASE_ENV_KEYS, async () => {
      const succeededRecord = createRecord({
        jobId: "job-phase63-succeeded",
        artifacts: [
          {
            artifactId: "artifact-phase63",
            jobId: "job-phase63-succeeded",
            kind: "render_output",
            format: "mp4",
            status: "available",
            createdAt: "2026-05-20T12:09:00.000Z",
            sizeBytes: 12345,
            durationMs: 42000,
          },
        ],
      });

      const successCalls: Array<{
        jobId: string;
        workerId: string;
        artifacts: BackendArtifactMetadata[];
      }> = [];

      const fakeRepository: SupabaseExportJobRegistryReadRepository = {
        createIfAbsent: async (record) => ({
          kind: "created",
          record,
        }),
        claimIfAvailable: async () => ({
          kind: "not_found",
        }),
        transitionIfOwned: async () => ({
          kind: "not_found",
        }),
        markSuccessIfOwned: async (input) => {
          successCalls.push(input);

          switch (input.jobId) {
            case "job-phase63-succeeded":
              return {
                kind: "succeeded",
                record: succeededRecord,
              };
            case "job-phase63-not-found":
              return {
                kind: "not_found",
              };
            case "job-phase63-not-owned":
              return {
                kind: "not_owned",
              };
            case "job-phase63-claim-expired":
              return {
                kind: "claim_expired",
              };
            case "job-phase63-not-transitionable":
              return {
                kind: "not_transitionable",
                reason: "status_mismatch",
              };
            case "job-phase63-version-conflict":
              return {
                kind: "version_conflict",
                existingRecord: createRecord({
                  jobId: "job-phase63-version-conflict",
                  status: "finalizing",
                  updatedAt: "2026-05-20T12:09:00.000Z",
                  completedAt: "2026-05-20T12:09:00.000Z",
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

      const safeArtifact = {
        artifactId: "artifact-phase63",
        jobId: "job-phase63-succeeded",
        kind: "render_output",
        format: "mp4",
        status: "available",
        createdAt: "2026-05-20T12:09:00.000Z",
        sizeBytes: 12345,
        durationMs: 42000,
      };

      await expect(
        registry.markSuccess("job-phase63-succeeded", "worker-phase63", [
          safeArtifact,
        ]),
      ).resolves.toEqual(succeededRecord);

      expect(successCalls).toEqual([
        {
          jobId: "job-phase63-succeeded",
          workerId: "worker-phase63",
          artifacts: [safeArtifact],
        },
      ]);

      await expect(
        registry.markSuccess("job-phase63-not-found", "worker-phase63", [
          { ...safeArtifact, jobId: "job-phase63-not-found" },
        ]),
      ).rejects.toThrow(/Export job 'job-phase63-not-found' was not found\./);

      await expect(
        registry.markSuccess("job-phase63-not-owned", "worker-phase63", [
          { ...safeArtifact, jobId: "job-phase63-not-owned" },
        ]),
      ).rejects.toThrow(
        /Worker does not own export job 'job-phase63-not-owned'\./,
      );

      await expect(
        registry.markSuccess("job-phase63-claim-expired", "worker-phase63", [
          { ...safeArtifact, jobId: "job-phase63-claim-expired" },
        ]),
      ).rejects.toThrow(
        /Export job 'job-phase63-claim-expired' claim has expired\./,
      );

      await expect(
        registry.markSuccess("job-phase63-not-transitionable", "worker-phase63", [
          { ...safeArtifact, jobId: "job-phase63-not-transitionable" },
        ]),
      ).rejects.toThrow(
        /Export job 'job-phase63-not-transitionable' is not in the expected status for transition to 'success'\./,
      );

      await expect(
        registry.markSuccess("job-phase63-version-conflict", "worker-phase63", [
          { ...safeArtifact, jobId: "job-phase63-version-conflict" },
        ]),
      ).rejects.toThrow(
        /Export job 'job-phase63-version-conflict' changed before transition to 'success' could be applied\./,
      );

      await expect(
        registry.markSuccess("job-phase63-succeeded", "worker-phase63", [
          {
            ...safeArtifact,
            path: "C:\\unsafe\\artifact.mp4",
          },
        ]),
      ).rejects.toThrow(/Artifact field 'path' is not allowed in this phase\./);

      await expect(
        registry.transition("job-phase63-succeeded", "success"),
      ).rejects.toThrow(/Method: transition\./);
    });
  });

  test("source documents adapter-only markSuccess support with env-gated backend dependency selection, no worker wiring, and no signed-url behavior", async () => {
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

    expect(specSource).toContain("markSuccessIfOwned");
    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(registrySource).toContain("async markSuccess(");
    expect(registrySource).toContain("validateArtifactMetadata");
    expect(registrySource).toContain("markSuccessIfOwned");
    expect(registrySource).toContain("createMarkSuccessTransitionError");
    expect(registrySource).toContain('throw this.createNotWiredError("transition")');
    expect(registrySource).not.toContain("signedUrl");
    expect(registrySource).not.toContain("downloadUrl");
    expect(registrySource).not.toContain("storage_refs");
    expect(registrySource).not.toContain("createClient(");
    expect(registrySource).not.toContain("readSupabaseConfigFromEnv");
    expect(registrySource).not.toContain(forbiddenSecretLogging);
    expect(registrySource).not.toContain(forbiddenSupabaseStart);
    expect(registrySource).not.toContain(forbiddenSupabaseLink);
    expect(registrySource).not.toContain(forbiddenSupabaseDb);

    expect(backendDependenciesSource).toContain("SupabaseExportJobRegistry");
    expect(appSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerSource).toContain('await registry.getByStatus("submitted")');
  });
});
