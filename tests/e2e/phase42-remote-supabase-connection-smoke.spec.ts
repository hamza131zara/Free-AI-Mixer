import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readSupabaseConfigFromEnv } from "../../backend/config/supabaseConfig";
import { createSupabaseClientFactory } from "../../backend/db/supabaseClientFactory";

const OPT_IN_ENV = "FREE_AI_MIXER_RUN_REMOTE_SUPABASE_SMOKE";
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
  "phase42-remote-supabase-connection-smoke.spec.ts",
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

  return "Unknown remote Supabase smoke failure.";
};

const buildForbiddenAnonEnvUsagePattern = (): string =>
  [
    "process",
    "env",
    ["FREE", "AI", "MIXER", "SUPABASE", "ANON", "KEY"].join("_"),
  ].join(".");

const buildForbiddenAnonConfigReadPattern = (): string =>
  [
    "readEnvValue",
    "(env, ",
    ["supabaseEnvKeys", "anonKey"].join("."),
    ")",
  ].join("");

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

test.describe("phase42 remote supabase connection smoke", () => {
  test("source stays backend-only read-only and avoids secret or anon-key usage", async () => {
    const source = await readSpecSource();
    const forbiddenAnonEnvUsage = buildForbiddenAnonEnvUsagePattern();
    const forbiddenAnonConfigRead = buildForbiddenAnonConfigReadPattern();
    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenInsertCall = buildForbiddenMutationCallPattern("insert");
    const forbiddenUpdateCall = buildForbiddenMutationCallPattern("update");
    const forbiddenDeleteCall = buildForbiddenMutationCallPattern("delete");
    const forbiddenUpsertCall = buildForbiddenMutationCallPattern("upsert");
    const forbiddenRpcCall = buildForbiddenMutationCallPattern("rpc");

    expect(source).toContain("readSupabaseConfigFromEnv");
    expect(source).toContain("createSupabaseClientFactory");
    expect(source).toContain('from("app_users").select("id").limit(1)');

    expect(source).not.toContain(forbiddenAnonEnvUsage);
    expect(source).not.toContain(forbiddenAnonConfigRead);
    expect(source).not.toContain(forbiddenSecretLogging);
    expect(source).not.toContain(forbiddenInsertCall);
    expect(source).not.toContain(forbiddenUpdateCall);
    expect(source).not.toContain(forbiddenDeleteCall);
    expect(source).not.toContain(forbiddenUpsertCall);
    expect(source).not.toContain(forbiddenRpcCall);
  });

  test("remote smoke is opt-in, read-only, and succeeds on an empty app_users result", async () => {
    test.skip(
      process.env[OPT_IN_ENV] !== "1",
      `Set ${OPT_IN_ENV}=1 to run the remote Supabase connection smoke test.`,
    );

    const missingEnvKeys = getMissingRequiredEnvKeys();
    expect(
      missingEnvKeys,
      `Remote Supabase smoke is opt-in and requires env vars: ${missingEnvKeys.join(", ")}`,
    ).toEqual([]);

    const config = readSupabaseConfigFromEnv(process.env);
    expect(config.enabled).toBe(true);
    expect(config.valid).toBe(true);

    const factoryResult = createSupabaseClientFactory(config);
    expect(factoryResult.kind).toBe("supabase_client_factory");

    if (factoryResult.kind !== "supabase_client_factory") {
      throw new Error("Remote Supabase smoke requires a valid backend-only client factory.");
    }

    const handle = factoryResult.createAdminClientHandle();

    try {
      const result = await handle.client.from("app_users").select("id").limit(1);

      expect(result.error).toBeNull();
      expect(Array.isArray(result.data) || result.data === null).toBeTruthy();
    } catch (error) {
      throw new Error(
        `Remote Supabase smoke failed during read-only app_users query: ${sanitizeSupabaseErrorMessage(error)}`,
      );
    }
  });
});
