import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  getMigrationWorkflowBoundary,
  migrationWorkflowBoundary,
} from "../../backend/db/migrationWorkflow";

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
const workflowSourcePath = path.join(
  process.cwd(),
  "backend",
  "db",
  "migrationWorkflow.ts",
);
const packageJsonPath = path.join(process.cwd(), "package.json");

const readText = (filePath: string): Promise<string> => fs.readFile(filePath, "utf8");

test.describe("phase31 migration workflow boundary", () => {
  test("migration file exists under backend db migrations", async () => {
    const migrationText = await readText(migrationFilePath);

    expect(migrationText).toContain("create table if not exists app_users");
    expect(migrationText).toContain("create table if not exists export_jobs");
  });

  test("workflow boundary stays non-executing and manual only", async () => {
    const workflow = getMigrationWorkflowBoundary();
    const sameWorkflow = migrationWorkflowBoundary;

    expect(workflow.kind).toBe("migration_workflow_boundary");
    expect(workflow).toBe(sameWorkflow);
    expect(workflow.executesOnStartup).toBeFalsy();
    expect(workflow.executesFromRoutes).toBeFalsy();
    expect(workflow.executesFromClientFactory).toBeFalsy();
    expect(workflow.requiresSupabaseCliSetup).toBeTruthy();
    expect(workflow.requiresExplicitTargetSelection).toBeTruthy();
    expect(workflow.commands).toHaveLength(2);

    for (const command of workflow.commands) {
      expect(command.executesMigrations).toBeFalsy();
      expect(command.requiresExplicitManualExecution).toBeTruthy();
      expect(command.requiresRealCredentials).toBeFalsy();
      expect(command.allowedInTests).toBeFalsy();
    }
  });

  test("app startup routes and client factory do not execute migrations", async () => {
    const [appSource, routeSource, clientFactorySource] = await Promise.all([
      readText(appSourcePath),
      readText(routeSourcePath),
      readText(clientFactorySourcePath),
    ]);

    expect(appSource).not.toContain("migrationWorkflow");
    expect(appSource).not.toContain("supabase migration");
    expect(appSource).not.toContain("db push");
    expect(appSource).not.toContain("db reset");
    expect(appSource).not.toContain("migrate(");

    expect(routeSource).not.toContain("migrationWorkflow");
    expect(routeSource).not.toContain("supabase migration");
    expect(routeSource).not.toContain("db push");
    expect(routeSource).not.toContain("db reset");
    expect(routeSource).not.toContain("migrate(");

    expect(clientFactorySource).not.toContain("migrationWorkflow");
    expect(clientFactorySource).not.toContain("supabase migration");
    expect(clientFactorySource).not.toContain("db push");
    expect(clientFactorySource).not.toContain("db reset");
    expect(clientFactorySource).not.toContain("migrate(");
  });

  test("workflow boundary does not execute cli commands in code or tests", async () => {
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
    expect(workflowSource).toContain('requiresExplicitManualExecution: true');
    expect(workflowSource).toContain('spawnsSupabaseCli: false');
    expect(workflowSource).toContain('spawnsDocker: false');
    expect(workflowSource).not.toContain("supabase db push --linked --yes");
    expect(workflowSource).not.toContain("SUPABASE_ACCESS_TOKEN");
  });

  test("package scripts remain free of migration execution shortcuts", async () => {
    const packageJson = JSON.parse(await readText(packageJsonPath)) as {
      scripts?: Record<string, string>;
    };
    const scripts = packageJson.scripts ?? {};
    const scriptNames = Object.keys(scripts);
    const scriptBodies = Object.values(scripts).join("\n");

    expect(scriptNames).not.toContain("db:migrate:local");
    expect(scriptNames).not.toContain("db:migrate:remote");
    expect(scriptNames).not.toContain("db:reset:local");
    expect(scriptNames).not.toContain("db:push");
    expect(scriptBodies).not.toContain("supabase db push");
    expect(scriptBodies).not.toContain("supabase migration up");
    expect(scriptBodies).not.toContain("supabase db reset");
  });

  test("workflow boundary requires no real credentials or project refs", async () => {
    const workflowSource = await readText(workflowSourcePath);

    expect(workflowSource).not.toContain("sbp_");
    expect(workflowSource).not.toContain("service_role");
    expect(workflowSource).not.toContain("project-ref");
    expect(workflowSource).not.toContain("FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY");
    expect(workflowSource).not.toContain("SUPABASE_ACCESS_TOKEN");
    expect(workflowSource).not.toContain("SUPABASE_PROJECT_REF");
  });
});
