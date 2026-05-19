import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { BackendExportJobRecord } from "../../backend/contracts/exportHttpTypes";
import { readSupabaseConfigFromEnv } from "../../backend/config/supabaseConfig";
import { createSupabaseClientFactory } from "../../backend/db/supabaseClientFactory";
import {
  SupabaseExportJobsRepository,
  type ExportJobRow,
  type SupabaseExportJobsClient,
} from "../../backend/repositories/supabaseExportJobsRepository";

const OPT_IN_ENV = "FREE_AI_MIXER_RUN_REMOTE_EXPORT_JOBS_REPOSITORY_SMOKE";
const REQUIRED_ENV_KEYS = [
  "FREE_AI_MIXER_ENABLE_SUPABASE_DB",
  "FREE_AI_MIXER_DB_PROVIDER",
  "FREE_AI_MIXER_SUPABASE_URL",
  "FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
] as const;

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase44-remote-export-jobs-repository-smoke.spec.ts",
);

const readSpecSource = async (): Promise<string> =>
  fs.readFile(specPath, "utf8");

const getMissingRequiredEnvKeys = (): string[] =>
  REQUIRED_ENV_KEYS.filter((key) => {
    const value = process.env[key];
    return typeof value !== "string" || value.trim().length === 0;
  });

const sanitizeSupabaseErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
      .replaceAll(process.env.FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY ?? "", "[redacted]")
      .replaceAll(process.env.FREE_AI_MIXER_SUPABASE_URL ?? "", "[redacted]");
  }

  return "Unknown remote export jobs repository smoke failure.";
};

const buildForbiddenAnonEnvUsagePattern = (): string =>
  [
    "process",
    "env",
    ["FREE", "AI", "MIXER", "SUPABASE", "ANON", "KEY"].join("_"),
  ].join(".");

const buildForbiddenRouteImportPattern = (): string =>
  ["../../backend/", "routes/"].join("");

const buildForbiddenAppImportPattern = (): string =>
  ["../../backend/", "app"].join("");

const buildForbiddenServerImportPattern = (): string =>
  ["../../backend/", "server"].join("");

const buildForbiddenCompositionPattern = (): string =>
  ["Repository", "Composition"].join("");

const buildForbiddenAccountWorkspaceRepositoryPattern = (): string =>
  ["Supabase", "Account", "Workspace", "Repository"].join("");

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

const buildForbiddenBroadCleanupPattern = (methodName: string): string =>
  [".", methodName, "("].join("");

const isoNow = (): string => new Date().toISOString();

const createExportJobRecord = (
  jobId: string,
  requestId: string,
  timelineId: string,
  ownerId: string,
  workspaceId: string,
  updatedAt: string,
  attemptCount: number,
  status: BackendExportJobRecord["status"],
  startedAt?: string,
): BackendExportJobRecord => ({
  jobId,
  requestId,
  timelineId,
  ownerId,
  workspaceId,
  status,
  attemptCount,
  createdAt: updatedAt,
  updatedAt,
  renderSettings: {
    format: "mp4",
    resolution: "720p",
    fps: 24,
    quality: "draft",
  },
  ...(startedAt ? { startedAt } : {}),
});

const cleanupInsertedRows = async (
  client: {
    from: (table: string) => {
      delete: () => {
        eq: (
          column: string,
          value: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  },
  jobId: string,
  workspaceId: string,
  userId: string,
): Promise<string[]> => {
  const cleanupErrors: string[] = [];

  const exportJobsDelete = await client.from("export_jobs").delete().eq("job_id", jobId);
  if (exportJobsDelete.error) {
    cleanupErrors.push(
      `export_jobs cleanup failed: ${sanitizeSupabaseErrorMessage(
        new Error(exportJobsDelete.error.message),
      )}`,
    );
  }

  const workspacesDelete = await client.from("workspaces").delete().eq("id", workspaceId);
  if (workspacesDelete.error) {
    cleanupErrors.push(
      `workspaces cleanup failed: ${sanitizeSupabaseErrorMessage(
        new Error(workspacesDelete.error.message),
      )}`,
    );
  }

  const appUsersDelete = await client.from("app_users").delete().eq("id", userId);
  if (appUsersDelete.error) {
    cleanupErrors.push(
      `app_users cleanup failed: ${sanitizeSupabaseErrorMessage(
        new Error(appUsersDelete.error.message),
      )}`,
    );
  }

  return cleanupErrors;
};

test.describe("phase44 remote export jobs repository smoke", () => {
  test("source stays backend-only, adapter-scoped, and uses exact-id cleanup", async () => {
    const source = await readSpecSource();
    const forbiddenAnonEnvUsage = buildForbiddenAnonEnvUsagePattern();
    const forbiddenRouteImport = buildForbiddenRouteImportPattern();
    const forbiddenAppImport = buildForbiddenAppImportPattern();
    const forbiddenServerImport = buildForbiddenServerImportPattern();
    const forbiddenComposition = buildForbiddenCompositionPattern();
    const forbiddenAccountWorkspaceRepository =
      buildForbiddenAccountWorkspaceRepositoryPattern();
    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");
    const forbiddenLikeCleanup = buildForbiddenBroadCleanupPattern("like");
    const forbiddenIlikeCleanup = buildForbiddenBroadCleanupPattern("ilike");

    expect(source).toContain("readSupabaseConfigFromEnv");
    expect(source).toContain("createSupabaseClientFactory");
    expect(source).toContain("SupabaseExportJobsRepository");
    expect(source).toContain("randomUUID()");
    expect(source).toContain('.eq("job_id", jobId)');
    expect(source).toContain('.eq("id", workspaceId)');
    expect(source).toContain('.eq("id", userId)');

    expect(source).not.toContain(forbiddenAnonEnvUsage);
    expect(source).not.toContain(forbiddenRouteImport);
    expect(source).not.toContain(forbiddenAppImport);
    expect(source).not.toContain(forbiddenServerImport);
    expect(source).not.toContain(forbiddenComposition);
    expect(source).not.toContain(forbiddenAccountWorkspaceRepository);
    expect(source).not.toContain(forbiddenSecretLogging);
    expect(source).not.toContain(forbiddenSupabaseStart);
    expect(source).not.toContain(forbiddenSupabaseLink);
    expect(source).not.toContain(forbiddenSupabaseDb);
    expect(source).not.toContain(forbiddenLikeCleanup);
    expect(source).not.toContain(forbiddenIlikeCleanup);
  });

  test("remote export jobs repository smoke is opt-in and validates upsert plus exact-id cleanup", async () => {
    test.skip(
      process.env[OPT_IN_ENV] !== "1",
      `Set ${OPT_IN_ENV}=1 to run the remote export jobs repository smoke test.`,
    );

    const missingEnvKeys = getMissingRequiredEnvKeys();
    expect(
      missingEnvKeys,
      `Remote export jobs repository smoke requires env vars: ${missingEnvKeys.join(", ")}`,
    ).toEqual([]);

    const config = readSupabaseConfigFromEnv(process.env);
    expect(config.enabled).toBe(true);
    expect(config.valid).toBe(true);

    const factoryResult = createSupabaseClientFactory(config);
    expect(factoryResult.kind).toBe("supabase_client_factory");

    if (factoryResult.kind !== "supabase_client_factory") {
      throw new Error(
        "Remote export jobs repository smoke requires a valid backend-only client factory.",
      );
    }

    const handle = factoryResult.createAdminClientHandle();
    const repository = new SupabaseExportJobsRepository(
      handle.client as unknown as SupabaseExportJobsClient<ExportJobRow>,
    );

    const userId = randomUUID();
    const workspaceId = randomUUID();
    const jobId = randomUUID();
    const runSuffix = `${Date.now()}`;
    const requestId = `phase44_request_${runSuffix}`;
    const timelineId = `phase44_timeline_${runSuffix}`;
    const appUserEmail = `phase44-${runSuffix}@example.test`;
    const authSubject = `phase44_auth_subject_${runSuffix}`;
    const workspaceName = `Phase 44 Workspace ${runSuffix}`;
    const createdAt = isoNow();
    const startedAt = isoNow();

    let runtimeFailure: string | undefined;

    try {
      const appUsersInsert = await handle.client.from("app_users").insert({
        id: userId,
        auth_provider: "local_dev_fallback",
        auth_subject: authSubject,
        email: appUserEmail,
      });
      expect(appUsersInsert.error).toBeNull();

      const workspacesInsert = await handle.client.from("workspaces").insert({
        id: workspaceId,
        name: workspaceName,
        created_by_user_id: userId,
      });
      expect(workspacesInsert.error).toBeNull();

      const initialRecord = createExportJobRecord(
        jobId,
        requestId,
        timelineId,
        userId,
        workspaceId,
        createdAt,
        0,
        "submitted",
      );

      await expect(repository.upsertJob(initialRecord)).resolves.toEqual(initialRecord);

      const recordByJobId = await repository.getByJobId(jobId);
      expect(recordByJobId).toMatchObject({
        jobId,
        requestId,
        timelineId,
        ownerId: userId,
        workspaceId,
        status: "submitted",
        attemptCount: 0,
        renderSettings: initialRecord.renderSettings,
      });

      const recordByScope = await repository.getByIdempotencyScope({
        workspaceId,
        ownerId: userId,
        requestId,
      });
      expect(recordByScope).toMatchObject({
        jobId,
        requestId,
        timelineId,
        ownerId: userId,
        workspaceId,
        status: "submitted",
        attemptCount: 0,
      });

      const updatedRecord = createExportJobRecord(
        jobId,
        requestId,
        timelineId,
        userId,
        workspaceId,
        startedAt,
        1,
        "rendering",
        startedAt,
      );

      await expect(repository.upsertJob(updatedRecord)).resolves.toEqual(updatedRecord);

      const updatedByScope = await repository.getByIdempotencyScope({
        workspaceId,
        ownerId: userId,
        requestId,
      });
      expect(updatedByScope).toMatchObject({
        jobId,
        requestId,
        timelineId,
        ownerId: userId,
        workspaceId,
        status: "rendering",
        attemptCount: 1,
        startedAt,
      });
    } catch (error) {
      runtimeFailure = sanitizeSupabaseErrorMessage(error);
    } finally {
      const cleanupErrors = await cleanupInsertedRows(handle.client, jobId, workspaceId, userId);

      if (cleanupErrors.length > 0) {
        const cleanupFailure = cleanupErrors.join(" | ");
        if (runtimeFailure) {
          throw new Error(
            `Remote export jobs repository smoke failed: ${runtimeFailure}. Cleanup also failed: ${cleanupFailure}`,
          );
        }

        throw new Error(
          `Remote export jobs repository smoke cleanup failed after exact-id delete attempts: ${cleanupFailure}`,
        );
      }
    }

    if (runtimeFailure) {
      throw new Error(
        `Remote export jobs repository smoke failed during adapter validation: ${runtimeFailure}`,
      );
    }
  });
});
