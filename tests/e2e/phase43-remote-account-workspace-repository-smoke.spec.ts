import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readSupabaseConfigFromEnv } from "../../backend/config/supabaseConfig";
import { createSupabaseClientFactory } from "../../backend/db/supabaseClientFactory";
import {
  SupabaseAccountWorkspaceRepository,
  type SupabaseAccountWorkspaceClient,
} from "../../backend/repositories/supabaseAccountWorkspaceRepository";

const OPT_IN_ENV = "FREE_AI_MIXER_RUN_REMOTE_ACCOUNT_WORKSPACE_REPOSITORY_SMOKE";
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
  "phase43-remote-account-workspace-repository-smoke.spec.ts",
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

  return "Unknown remote account/workspace repository smoke failure.";
};

const buildForbiddenAnonEnvUsagePattern = (): string =>
  [
    "process",
    "env",
    ["FREE", "AI", "MIXER", "SUPABASE", "ANON", "KEY"].join("_"),
  ].join(".");

const buildForbiddenCompositionPattern = (): string =>
  ["create", "Repository", "Composition"].join("");

const buildForbiddenExportJobsRepositoryPattern = (): string =>
  ["Supabase", "Export", "Jobs", "Repository"].join("");

const buildForbiddenSecretLoggingPattern = (): string =>
  [
    "console",
    "log(process",
    "env",
    ["FREE", "AI", "MIXER", "SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"),
    ")",
  ].join(".");

const buildForbiddenMutationCallPattern = (methodName: string): string =>
  [".", methodName, "("].join("");

test.describe("phase43 remote account/workspace repository smoke", () => {
  test("source stays backend-only, read-only, and adapter-scoped", async () => {
    const source = await readSpecSource();
    const forbiddenAnonEnvUsage = buildForbiddenAnonEnvUsagePattern();
    const forbiddenComposition = buildForbiddenCompositionPattern();
    const forbiddenExportJobsRepository = buildForbiddenExportJobsRepositoryPattern();
    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenInsertCall = buildForbiddenMutationCallPattern("insert");
    const forbiddenUpdateCall = buildForbiddenMutationCallPattern("update");
    const forbiddenDeleteCall = buildForbiddenMutationCallPattern("delete");
    const forbiddenUpsertCall = buildForbiddenMutationCallPattern("upsert");
    const forbiddenRpcCall = buildForbiddenMutationCallPattern("rpc");

    expect(source).toContain("readSupabaseConfigFromEnv");
    expect(source).toContain("createSupabaseClientFactory");
    expect(source).toContain("SupabaseAccountWorkspaceRepository");
    expect(source).toContain('phase43_missing_user_${runSuffix}');
    expect(source).toContain('phase43_missing_workspace_${runSuffix}');
    expect(source).toContain('phase43_missing_auth_subject_${runSuffix}');

    expect(source).not.toContain(forbiddenAnonEnvUsage);
    expect(source).not.toContain(forbiddenComposition);
    expect(source).not.toContain(forbiddenExportJobsRepository);
    expect(source).not.toContain(forbiddenSecretLogging);
    expect(source).not.toContain(forbiddenInsertCall);
    expect(source).not.toContain(forbiddenUpdateCall);
    expect(source).not.toContain(forbiddenDeleteCall);
    expect(source).not.toContain(forbiddenUpsertCall);
    expect(source).not.toContain(forbiddenRpcCall);
  });

  test("remote repository smoke is opt-in, read-only, and safe on empty results", async () => {
    test.skip(
      process.env[OPT_IN_ENV] !== "1",
      `Set ${OPT_IN_ENV}=1 to run the remote account/workspace repository smoke test.`,
    );

    const missingEnvKeys = getMissingRequiredEnvKeys();
    expect(
      missingEnvKeys,
      `Remote account/workspace repository smoke requires env vars: ${missingEnvKeys.join(", ")}`,
    ).toEqual([]);

    const config = readSupabaseConfigFromEnv(process.env);
    expect(config.enabled).toBe(true);
    expect(config.valid).toBe(true);

    const factoryResult = createSupabaseClientFactory(config);
    expect(factoryResult.kind).toBe("supabase_client_factory");

    if (factoryResult.kind !== "supabase_client_factory") {
      throw new Error(
        "Remote account/workspace repository smoke requires a valid backend-only client factory.",
      );
    }

    const handle = factoryResult.createAdminClientHandle();
    const repository = new SupabaseAccountWorkspaceRepository(
      handle.client as unknown as SupabaseAccountWorkspaceClient,
    );

    const runSuffix = `${Date.now()}`;
    const missingUserId = `phase43_missing_user_${runSuffix}`;
    const missingWorkspaceId = `phase43_missing_workspace_${runSuffix}`;
    const missingAuthSubject = `phase43_missing_auth_subject_${runSuffix}`;

    try {
      await expect(repository.getByUserId(missingUserId)).resolves.toBeUndefined();
      await expect(
        repository.getByAuthSubject("local_dev_fallback", missingAuthSubject),
      ).resolves.toBeUndefined();
      await expect(repository.getByWorkspaceId(missingWorkspaceId)).resolves.toBeUndefined();
      await expect(
        repository.getMembership(missingWorkspaceId, missingUserId),
      ).resolves.toBeUndefined();
      await expect(
        repository.listMembershipsForWorkspace(missingWorkspaceId),
      ).resolves.toEqual([]);
      await expect(repository.listForUser(missingUserId)).resolves.toEqual([]);
    } catch (error) {
      throw new Error(
        `Remote account/workspace repository smoke failed during read-only adapter calls: ${sanitizeSupabaseErrorMessage(error)}`,
      );
    }
  });
});
