import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  getLocalMigrationPreflightBoundary,
  localMigrationPreflightBoundary,
} from "../../backend/db/migrationWorkflow";

const migrationFilePath = path.join(
  process.cwd(),
  "backend",
  "db",
  "migrations",
  "0001_initial_supabase_postgres_schema.sql",
);
const workflowSourcePath = path.join(
  process.cwd(),
  "backend",
  "db",
  "migrationWorkflow.ts",
);
const appSourcePath = path.join(process.cwd(), "backend", "app.ts");
const routeSourcePath = path.join(
  process.cwd(),
  "backend",
  "routes",
  "exports.ts",
);
const clientFactorySourcePath = path.join(
  process.cwd(),
  "backend",
  "db",
  "supabaseClientFactory.ts",
);
const packageJsonPath = path.join(process.cwd(), "package.json");
const requesterRoot = path.join(process.cwd(), "backend", "requester");
const authRoot = path.join(process.cwd(), "backend", "auth");
const frontendRoot = path.join(process.cwd(), "src");

const readText = (filePath: string): Promise<string> => fs.readFile(filePath, "utf8");

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

test.describe("phase36 local migration preflight boundary", () => {
  test("local-only migration preflight boundary exists and explicitly selects the current migration file", async () => {
    const boundary = getLocalMigrationPreflightBoundary();
    const migrationText = await readText(migrationFilePath);

    expect(boundary).toBe(localMigrationPreflightBoundary);
    expect(boundary.kind).toBe("local_migration_preflight_boundary");
    expect(boundary.localOnly).toBeTruthy();
    expect(boundary.remoteOrProductionDeferred).toBeTruthy();
    expect(boundary.manualInvocationOnly).toBeTruthy();
    expect(boundary.executesMigrations).toBeFalsy();
    expect(boundary.spawnsSupabaseCli).toBeFalsy();
    expect(boundary.requiresExplicitMigrationFileSelection).toBeTruthy();
    expect(boundary.migrationFilePath).toBe(
      "backend/db/migrations/0001_initial_supabase_postgres_schema.sql",
    );
    expect(boundary.resetOrRollbackScope).toBe("local_dev_only");
    expect(migrationText).toContain("create table if not exists app_users");
    expect(migrationText).toContain("create table if not exists export_jobs");
  });

  test("preflight models local-only safety gates without remote or credential defaults", () => {
    const boundary = getLocalMigrationPreflightBoundary();

    expect(boundary.requiresCleanGitStatus).toBeTruthy();
    expect(boundary.requiresNoRemoteProjectLink).toBeTruthy();
    expect(boundary.requiresNoProductionCredentials).toBeTruthy();
    expect(boundary.intendedValidationMode).toBe("manual_local_supabase_only");
  });

  test("preflight boundary source does not spawn cli execute migrations or embed remote refs", async () => {
    const workflowSource = await readText(workflowSourcePath);

    expect(workflowSource).not.toContain("child_process");
    expect(workflowSource).not.toContain("exec(");
    expect(workflowSource).not.toContain("spawn(");
    expect(workflowSource).not.toContain("spawnSync(");
    expect(workflowSource).not.toContain("execSync(");
    expect(workflowSource).not.toContain("execFile(");
    expect(workflowSource).not.toContain("execFileSync(");
    expect(workflowSource).not.toContain("execa");
    expect(workflowSource).toContain('executesMigrations: false');
    expect(workflowSource).toContain('spawnsSupabaseCli: false');
    expect(workflowSource).toContain('manualInvocationOnly: true');
    expect(workflowSource).toContain('localOnly: true');
    expect(workflowSource).not.toContain("--linked --yes");
    expect(workflowSource).not.toContain("project-ref");
    expect(workflowSource).not.toContain("SUPABASE_ACCESS_TOKEN");
    expect(workflowSource).not.toContain("FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY");
    expect(workflowSource).not.toContain("sbp_");
  });

  test("app routes and client factory do not execute migration preflight", async () => {
    const [appSource, routeSource, clientFactorySource] = await Promise.all([
      readText(appSourcePath),
      readText(routeSourcePath),
      readText(clientFactorySourcePath),
    ]);

    expect(appSource).not.toContain("localMigrationPreflightBoundary");
    expect(appSource).not.toContain("getLocalMigrationPreflightBoundary");
    expect(appSource).not.toContain("migrationWorkflow");

    expect(routeSource).not.toContain("localMigrationPreflightBoundary");
    expect(routeSource).not.toContain("getLocalMigrationPreflightBoundary");
    expect(routeSource).not.toContain("migrationWorkflow");

    expect(clientFactorySource).not.toContain("localMigrationPreflightBoundary");
    expect(clientFactorySource).not.toContain("getLocalMigrationPreflightBoundary");
    expect(clientFactorySource).not.toContain("migrationWorkflow");
  });

  test("no route auth requester frontend storage or billing wiring is introduced and package scripts stay non-executing", async () => {
    const [requesterSources, authSources, frontendSources, packageJson] =
      await Promise.all([
        getAllFileContents(requesterRoot),
        getAllFileContents(authRoot),
        getAllFileContents(frontendRoot),
        readText(packageJsonPath),
      ]);

    expect(requesterSources.join("\n")).not.toContain("localMigrationPreflightBoundary");
    expect(requesterSources.join("\n")).not.toContain("getLocalMigrationPreflightBoundary");
    expect(authSources.join("\n")).not.toContain("localMigrationPreflightBoundary");
    expect(authSources.join("\n")).not.toContain("getLocalMigrationPreflightBoundary");
    expect(frontendSources.join("\n")).not.toContain("localMigrationPreflightBoundary");
    expect(frontendSources.join("\n")).not.toContain("getLocalMigrationPreflightBoundary");
    expect(frontendSources.join("\n")).not.toContain("@supabase/supabase-js");

    const packageJsonObject = JSON.parse(packageJson) as {
      scripts?: Record<string, string>;
    };
    const scripts = packageJsonObject.scripts ?? {};
    const scriptNames = Object.keys(scripts);
    const scriptBodies = Object.values(scripts).join("\n");

    expect(scriptNames).not.toContain("db:migrate:local");
    expect(scriptNames).not.toContain("db:migrate:remote");
    expect(scriptNames).not.toContain("db:preflight:local");
    expect(scriptBodies).not.toContain("supabase db reset");
    expect(scriptBodies).not.toContain("supabase migration up");
    expect(scriptBodies).not.toContain("supabase db push");
    expect(scriptBodies).not.toContain("supabase start");
  });
});
