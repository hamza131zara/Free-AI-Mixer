import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  getPublicSupabaseConfig,
  parseSupabaseConfig,
  supabaseEnvKeys,
} from "../../backend/config/supabaseConfig";

const configSourcePath = path.join(
  process.cwd(),
  "backend",
  "config",
  "supabaseConfig.ts",
);
const packageJsonPath = path.join(process.cwd(), "package.json");

test.describe("phase28 supabase config boundary", () => {
  test("returns disabled config when env is missing", () => {
    const config = parseSupabaseConfig({});

    expect(config.enabled).toBeFalsy();
    expect(config.valid).toBeTruthy();
    expect(config.dbProvider).toBe("disabled");
    expect(config.migrationExecutionRequested).toBeFalsy();
    expect(config.errors).toEqual([]);
  });

  test("returns enabled valid config only with explicit enable flag and required backend values", () => {
    const config = parseSupabaseConfig({
      [supabaseEnvKeys.enableSupabaseDb]: "1",
      [supabaseEnvKeys.dbProvider]: "supabase",
      [supabaseEnvKeys.projectUrl]: "https://example.supabase.co",
      [supabaseEnvKeys.serviceRoleKey]: "service-role-placeholder",
      [supabaseEnvKeys.anonKey]: "anon-placeholder",
      [supabaseEnvKeys.appMode]: "development",
      [supabaseEnvKeys.enableDbMigrations]: "1",
      [supabaseEnvKeys.storageBucketArtifacts]: "artifacts",
      [supabaseEnvKeys.storageBucketUploads]: "uploads",
    });

    expect(config.enabled).toBeTruthy();
    expect(config.valid).toBeTruthy();
    expect(config.dbProvider).toBe("supabase");
    expect(config.projectUrl).toBe("https://example.supabase.co");
    expect(config.serviceRoleKey).toBe("service-role-placeholder");
    expect(config.migrationExecutionRequested).toBeTruthy();
    expect(config.errors).toEqual([]);
  });

  test("missing service role is invalid when db is explicitly enabled", () => {
    const config = parseSupabaseConfig({
      [supabaseEnvKeys.enableSupabaseDb]: "1",
      [supabaseEnvKeys.dbProvider]: "supabase",
      [supabaseEnvKeys.projectUrl]: "https://example.supabase.co",
    });

    expect(config.enabled).toBeTruthy();
    expect(config.valid).toBeFalsy();
    expect(config.errors).toContain(
      `${supabaseEnvKeys.serviceRoleKey} is required when ${supabaseEnvKeys.enableSupabaseDb}=1.`,
    );
  });

  test("public projection omits service role and backend-only values", () => {
    const config = parseSupabaseConfig({
      [supabaseEnvKeys.enableSupabaseDb]: "1",
      [supabaseEnvKeys.dbProvider]: "supabase",
      [supabaseEnvKeys.projectUrl]: "https://example.supabase.co",
      [supabaseEnvKeys.serviceRoleKey]: "service-role-placeholder",
      [supabaseEnvKeys.databaseUrl]: "postgres://db-user:db-pass@example/db",
      [supabaseEnvKeys.anonKey]: "anon-placeholder",
      [supabaseEnvKeys.enableDbMigrations]: "1",
    });
    const publicConfig = getPublicSupabaseConfig(config);

    expect(publicConfig.enabled).toBeTruthy();
    expect(publicConfig.valid).toBeTruthy();
    expect(publicConfig.projectUrl).toBe("https://example.supabase.co");
    expect(publicConfig.anonKey).toBe("anon-placeholder");
    expect("serviceRoleKey" in publicConfig).toBeFalsy();
    expect("databaseUrl" in publicConfig).toBeFalsy();
    expect("migrationExecutionRequested" in publicConfig).toBeFalsy();
  });

  test("vite-style service-role exposure is rejected", () => {
    const config = parseSupabaseConfig({
      [supabaseEnvKeys.enableSupabaseDb]: "1",
      [supabaseEnvKeys.dbProvider]: "supabase",
      [supabaseEnvKeys.projectUrl]: "https://example.supabase.co",
      [supabaseEnvKeys.viteServiceRoleKey]: "bad-browser-secret",
    });

    expect(config.enabled).toBeTruthy();
    expect(config.valid).toBeFalsy();
    expect(config.errors).toContain(
      `${supabaseEnvKeys.viteServiceRoleKey} must not be used for backend Supabase configuration.`,
    );
  });

  test("no supabase dependency exists in package json", async () => {
    const packageJson = await fs.readFile(packageJsonPath, "utf8");

    expect(packageJson).not.toContain("@supabase/supabase-js");
    expect(packageJson).not.toContain("\"supabase\"");
  });

  test("config boundary does not introduce route frontend or runtime db behavior", async () => {
    const source = await fs.readFile(configSourcePath, "utf8");

    expect(source).not.toContain("createClient(");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("Router");
    expect(source).not.toContain("window.");
    expect(source).not.toContain("express");
    expect(source).not.toContain("migrate(");
    expect(source).not.toContain("signed_url");
  });
});
