import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  getLocalCliDockerReadinessBoundary,
  localCliDockerReadinessBoundary,
} from "../../backend/db/migrationWorkflow";

const workflowSourcePath = path.join(
  process.cwd(),
  "backend",
  "db",
  "migrationWorkflow.ts",
);
const migrationFilePath = path.join(
  process.cwd(),
  "backend",
  "db",
  "migrations",
  "0001_initial_supabase_postgres_schema.sql",
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
const requesterRoot = path.join(process.cwd(), "backend", "requester");
const authRoot = path.join(process.cwd(), "backend", "auth");
const frontendRoot = path.join(process.cwd(), "src");
const packageJsonPath = path.join(process.cwd(), "package.json");

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

test.describe("phase37 local cli docker readiness boundary", () => {
  test("readiness boundary exists and stays unverified by default", async () => {
    const boundary = getLocalCliDockerReadinessBoundary();
    const migrationText = await readText(migrationFilePath);

    expect(boundary).toBe(localCliDockerReadinessBoundary);
    expect(boundary.kind).toBe("local_cli_docker_readiness_boundary");
    expect(boundary.localOnly).toBeTruthy();
    expect(boundary.manualOnly).toBeTruthy();
    expect(boundary.cliReadinessVerifiedByDefault).toBeFalsy();
    expect(boundary.dockerReadinessVerifiedByDefault).toBeFalsy();
    expect(boundary.executesMigrations).toBeFalsy();
    expect(boundary.spawnsSupabaseCli).toBeFalsy();
    expect(boundary.spawnsDocker).toBeFalsy();
    expect(boundary.remoteOrProductionDeferred).toBeTruthy();
    expect(boundary.migrationFilePath).toBe(
      "backend/db/migrations/0001_initial_supabase_postgres_schema.sql",
    );
    expect(migrationText).toContain("create table if not exists app_users");
  });

  test("future manual command names are described but not executed", () => {
    const boundary = getLocalCliDockerReadinessBoundary();
    const commandExamples = boundary.checks.map((check) => check.exampleCommand);

    expect(boundary.checks).toHaveLength(7);
    expect(commandExamples).toContain("supabase --version");
    expect(commandExamples).toContain("supabase status");
    expect(commandExamples).toContain("supabase start");
    expect(commandExamples).toContain("supabase stop");
    expect(commandExamples).toContain("supabase db reset");
    expect(commandExamples).toContain("docker --version");
    expect(commandExamples).toContain("docker info");

    for (const check of boundary.checks) {
      expect(check.manualOnly).toBeTruthy();
      expect(check.readinessVerifiedByDefault).toBeFalsy();
      expect(check.executesMigrations).toBeFalsy();
      expect(check.spawnsProcessInCode).toBeFalsy();
      expect(check.localOnly).toBeTruthy();
    }
  });

  test("workflow source does not spawn cli or docker commands and does not embed remote refs or credentials", async () => {
    const workflowSource = await readText(workflowSourcePath);

    expect(workflowSource).not.toContain("child_process");
    expect(workflowSource).not.toContain("exec(");
    expect(workflowSource).not.toContain("spawn(");
    expect(workflowSource).not.toContain("spawnSync(");
    expect(workflowSource).not.toContain("execSync(");
    expect(workflowSource).not.toContain("docker compose");
    expect(workflowSource).not.toContain("SUPABASE_ACCESS_TOKEN");
    expect(workflowSource).not.toContain("SUPABASE_PROJECT_REF");
    expect(workflowSource).not.toContain("project-ref");
    expect(workflowSource).not.toContain("FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY");
    expect(workflowSource).not.toContain("sbp_");
  });

  test("app routes and client factory do not execute readiness checks", async () => {
    const [appSource, routeSource, clientFactorySource] = await Promise.all([
      readText(appSourcePath),
      readText(routeSourcePath),
      readText(clientFactorySourcePath),
    ]);

    expect(appSource).not.toContain("localCliDockerReadinessBoundary");
    expect(appSource).not.toContain("getLocalCliDockerReadinessBoundary");
    expect(routeSource).not.toContain("localCliDockerReadinessBoundary");
    expect(routeSource).not.toContain("getLocalCliDockerReadinessBoundary");
    expect(clientFactorySource).not.toContain("localCliDockerReadinessBoundary");
    expect(clientFactorySource).not.toContain("getLocalCliDockerReadinessBoundary");
  });

  test("no route auth requester frontend storage or billing wiring is introduced and package scripts stay clean", async () => {
    const [requesterSources, authSources, frontendSources, packageJson] =
      await Promise.all([
        getAllFileContents(requesterRoot),
        getAllFileContents(authRoot),
        getAllFileContents(frontendRoot),
        readText(packageJsonPath),
      ]);

    expect(requesterSources.join("\n")).not.toContain("localCliDockerReadinessBoundary");
    expect(requesterSources.join("\n")).not.toContain("getLocalCliDockerReadinessBoundary");
    expect(authSources.join("\n")).not.toContain("localCliDockerReadinessBoundary");
    expect(authSources.join("\n")).not.toContain("getLocalCliDockerReadinessBoundary");
    expect(frontendSources.join("\n")).not.toContain("localCliDockerReadinessBoundary");
    expect(frontendSources.join("\n")).not.toContain("getLocalCliDockerReadinessBoundary");
    expect(frontendSources.join("\n")).not.toContain("@supabase/supabase-js");

    const packageJsonObject = JSON.parse(packageJson) as {
      scripts?: Record<string, string>;
    };
    const scripts = packageJsonObject.scripts ?? {};
    const scriptNames = Object.keys(scripts);
    const scriptBodies = Object.values(scripts).join("\n");

    expect(scriptNames).not.toContain("supabase:start");
    expect(scriptNames).not.toContain("supabase:status");
    expect(scriptNames).not.toContain("db:reset:local");
    expect(scriptNames).not.toContain("docker:info");
    expect(scriptBodies).not.toContain("supabase start");
    expect(scriptBodies).not.toContain("supabase status");
    expect(scriptBodies).not.toContain("supabase db reset");
    expect(scriptBodies).not.toContain("docker info");
    expect(scriptBodies).not.toContain("docker --version");
  });
});
