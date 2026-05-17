import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseSupabaseConfig, supabaseEnvKeys } from "../../backend/config/supabaseConfig";
import {
  createRepositoryComposition,
} from "../../backend/composition/repositoryComposition";
import { createBackendDependencies } from "../../backend/composition/backendDependencies";
import type { SupabaseClientFactory } from "../../backend/db/supabaseClientFactory";

const compositionSourcePath = path.join(
  process.cwd(),
  "backend",
  "composition",
  "repositoryComposition.ts",
);
const dependenciesSourcePath = path.join(
  process.cwd(),
  "backend",
  "composition",
  "backendDependencies.ts",
);
const routeRoot = path.join(process.cwd(), "backend", "routes");
const authRoot = path.join(process.cwd(), "backend", "auth");
const requesterRoot = path.join(process.cwd(), "backend", "requester");
const frontendRoot = path.join(process.cwd(), "src");
const appSourcePath = path.join(process.cwd(), "backend", "app.ts");

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

const fakeClientFactory: SupabaseClientFactory = {
  kind: "supabase_client_factory",
  enabled: true,
  valid: true,
  runtime: "sdk_installed",
  publicConfig: {
    enabled: true,
    valid: true,
    dbProvider: "supabase",
    appMode: "test",
    projectUrl: "https://example.supabase.co",
    anonKey: "anon-placeholder",
  },
  createAdminClientHandle: () => ({
    kind: "supabase_admin_client_handle",
    runtime: "sdk_installed",
    projectUrl: "https://example.supabase.co",
    client: {
      from: () => ({}) as unknown,
    } as never,
  }),
};

test.describe("phase34 repository composition boundary", () => {
  test("repository composition is disabled by default", () => {
    const dependencies = createBackendDependencies();

    expect(dependencies.repositoryComposition.kind).toBe("repository_composition_disabled");
    expect(dependencies.repositoryComposition.dbBacked).toBeFalsy();
    expect(dependencies.repositoryComposition.reason).toBe("disabled");
    expect("serviceRoleKey" in dependencies.repositoryComposition.publicConfig).toBeFalsy();
  });

  test("env config gated DB composition only activates when explicitly enabled", () => {
    const config = parseSupabaseConfig({
      [supabaseEnvKeys.enableSupabaseDb]: "1",
      [supabaseEnvKeys.dbProvider]: "supabase",
      [supabaseEnvKeys.projectUrl]: "https://example.supabase.co",
      [supabaseEnvKeys.serviceRoleKey]: "service-role-placeholder",
      [supabaseEnvKeys.anonKey]: "anon-placeholder",
      [supabaseEnvKeys.appMode]: "test",
    });
    const composition = createRepositoryComposition(config, fakeClientFactory);

    expect(composition.kind).toBe("repository_composition_available");
    expect(composition.dbBacked).toBeTruthy();
    expect(composition.publicConfig.projectUrl).toBe("https://example.supabase.co");
    expect("serviceRoleKey" in composition.publicConfig).toBeFalsy();
  });

  test("fake mock composition works without real credentials and without DB readiness claims", async () => {
    const source = await fs.readFile(compositionSourcePath, "utf8");
    const config = parseSupabaseConfig({
      [supabaseEnvKeys.enableSupabaseDb]: "1",
      [supabaseEnvKeys.dbProvider]: "supabase",
      [supabaseEnvKeys.projectUrl]: "https://example.supabase.co",
      [supabaseEnvKeys.serviceRoleKey]: "service-role-placeholder",
      [supabaseEnvKeys.anonKey]: "anon-placeholder",
      [supabaseEnvKeys.appMode]: "test",
    });
    const composition = createRepositoryComposition(config, {
      ...fakeClientFactory,
      createAdminClientHandle: () => ({
        ...fakeClientFactory.createAdminClientHandle(),
        client: {
          from: () => ({}) as unknown,
        } as never,
      }),
    });

    expect(composition.kind).toBe("repository_composition_available");
    expect(typeof composition.createRepositories).toBe("function");
    const repositories = composition.createRepositories();
    expect(repositories.exportJobsRepository).toBeDefined();
    expect(repositories.userAccountRepository).toBeDefined();
    expect(repositories.workspaceRepository).toBeDefined();
    expect(repositories.workspaceMembershipRepository).toBeDefined();
    expect(source).not.toContain("migrate(");
    expect(source).not.toContain("migrationWorkflow");
    expect(source).not.toContain("serviceRoleKey:");
    expect(source).not.toContain("DB readiness");
  });

  test("no route files import DB repository adapters and app startup does not hard depend on them", async () => {
    const [routeSources, appSource, dependenciesSource] = await Promise.all([
      getAllFileContents(routeRoot),
      fs.readFile(appSourcePath, "utf8"),
      fs.readFile(dependenciesSourcePath, "utf8"),
    ]);

    expect(routeSources.join("\n")).not.toContain("supabaseExportJobsRepository");
    expect(routeSources.join("\n")).not.toContain("supabaseAccountWorkspaceRepository");
    expect(appSource).not.toContain("supabaseExportJobsRepository");
    expect(appSource).not.toContain("supabaseAccountWorkspaceRepository");
    expect(dependenciesSource).toContain("repositoryComposition");
    expect(appSource).not.toContain("repositoryComposition.");
  });

  test("no auth requester wiring frontend imports or migration execution are introduced", async () => {
    const [authSources, requesterSources, frontendSources, compositionSource] =
      await Promise.all([
        getAllFileContents(authRoot),
        getAllFileContents(requesterRoot),
        getAllFileContents(frontendRoot),
        fs.readFile(compositionSourcePath, "utf8"),
      ]);

    expect(authSources.join("\n")).not.toContain("supabaseExportJobsRepository");
    expect(authSources.join("\n")).not.toContain("supabaseAccountWorkspaceRepository");
    expect(requesterSources.join("\n")).not.toContain("supabaseExportJobsRepository");
    expect(requesterSources.join("\n")).not.toContain("supabaseAccountWorkspaceRepository");
    expect(frontendSources.join("\n")).not.toContain("supabaseExportJobsRepository");
    expect(frontendSources.join("\n")).not.toContain("supabaseAccountWorkspaceRepository");
    expect(frontendSources.join("\n")).not.toContain("repositoryComposition");
    expect(compositionSource).not.toContain("signed_url");
    expect(compositionSource).not.toContain("credit_ledger");
    expect(compositionSource).not.toContain("provider_keys");
    expect(compositionSource).not.toContain("storage_refs");
  });
});
