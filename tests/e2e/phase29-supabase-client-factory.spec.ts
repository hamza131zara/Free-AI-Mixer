import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseSupabaseConfig, supabaseEnvKeys } from "../../backend/config/supabaseConfig";
import { createSupabaseClientFactory } from "../../backend/db/supabaseClientFactory";

const packageJsonPath = path.join(process.cwd(), "package.json");
const routeRoot = path.join(process.cwd(), "backend", "routes");
const frontendRoot = path.join(process.cwd(), "src");
const repositoryRoot = path.join(process.cwd(), "backend", "repositories");
const factorySourcePath = path.join(
  process.cwd(),
  "backend",
  "db",
  "supabaseClientFactory.ts",
);

const getAllFileContents = async (rootPath: string): Promise<string[]> => {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(rootPath, entry.name);
      if (entry.isDirectory()) {
        return getAllFileContents(fullPath);
      }

      if (!entry.isFile()) {
        return [] as string[];
      }

      return [await fs.readFile(fullPath, "utf8")];
    }),
  );

  return nested.flat();
};

test.describe("phase29 supabase client factory boundary", () => {
  test("disabled config returns unavailable no-client result", () => {
    const config = parseSupabaseConfig({});
    const result = createSupabaseClientFactory(config);

    expect(result.kind).toBe("supabase_client_unavailable");
    expect(result.reason).toBe("disabled");
    expect(result.enabled).toBeFalsy();
    expect(result.valid).toBeTruthy();
    expect("createAdminClientHandle" in result).toBeFalsy();
  });

  test("invalid config returns unavailable no-client result", () => {
    const config = parseSupabaseConfig({
      [supabaseEnvKeys.enableSupabaseDb]: "1",
      [supabaseEnvKeys.dbProvider]: "supabase",
      [supabaseEnvKeys.projectUrl]: "https://example.supabase.co",
    });
    const result = createSupabaseClientFactory(config);

    expect(result.kind).toBe("supabase_client_unavailable");
    expect(result.reason).toBe("invalid_config");
    expect(result.enabled).toBeTruthy();
    expect(result.valid).toBeFalsy();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("enabled valid config remains truthful and does not create a live client", () => {
    const config = parseSupabaseConfig({
      [supabaseEnvKeys.enableSupabaseDb]: "1",
      [supabaseEnvKeys.dbProvider]: "supabase",
      [supabaseEnvKeys.projectUrl]: "https://example.supabase.co",
      [supabaseEnvKeys.serviceRoleKey]: "service-role-placeholder",
      [supabaseEnvKeys.anonKey]: "anon-placeholder",
    });
    const result = createSupabaseClientFactory(config);

    expect(result.kind).toBe("supabase_client_factory");
    expect(result.enabled).toBeTruthy();
    expect(result.valid).toBeTruthy();
    expect(result.runtime).toBe("sdk_not_installed");

    const handle = result.createAdminClientHandle();
    expect(handle.kind).toBe("supabase_admin_client_handle");
    expect(handle.runtime).toBe("sdk_not_installed");
    expect("client" in handle).toBeFalsy();
    expect("createClient" in handle).toBeFalsy();
  });

  test("service role key is not exposed through public result shape", () => {
    const config = parseSupabaseConfig({
      [supabaseEnvKeys.enableSupabaseDb]: "1",
      [supabaseEnvKeys.dbProvider]: "supabase",
      [supabaseEnvKeys.projectUrl]: "https://example.supabase.co",
      [supabaseEnvKeys.serviceRoleKey]: "service-role-placeholder",
      [supabaseEnvKeys.databaseUrl]: "postgres://db-user:db-pass@example/db",
      [supabaseEnvKeys.anonKey]: "anon-placeholder",
      [supabaseEnvKeys.enableDbMigrations]: "1",
    });
    const result = createSupabaseClientFactory(config);

    expect("serviceRoleKey" in result.publicConfig).toBeFalsy();
    expect("databaseUrl" in result.publicConfig).toBeFalsy();
    expect("migrationExecutionRequested" in result.publicConfig).toBeFalsy();
  });

  test("no supabase sdk dependency exists in package json", async () => {
    const packageJson = await fs.readFile(packageJsonPath, "utf8");

    expect(packageJson).not.toContain("@supabase/supabase-js");
    expect(packageJson).not.toContain("\"supabase\"");
  });

  test("route and frontend sources do not import the client factory", async () => {
    const routeSources = await getAllFileContents(routeRoot);
    const frontendSources = await getAllFileContents(frontendRoot);

    expect(routeSources.join("\n")).not.toContain("supabaseClientFactory");
    expect(frontendSources.join("\n")).not.toContain("supabaseClientFactory");
  });

  test("factory source does not add repository adapter or migration execution behavior", async () => {
    const source = await fs.readFile(factorySourcePath, "utf8");
    const repositorySources = await getAllFileContents(repositoryRoot);

    expect(source).not.toContain("@supabase/supabase-js");
    expect(source).not.toContain("createClient(");
    expect(source).not.toContain("migrate(");
    expect(source).not.toContain("connect(");
    expect(source).not.toContain("execute(");
    expect(repositorySources.join("\n")).not.toContain("supabaseClientFactory");
  });
});
