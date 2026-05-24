import { expect, test } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("product phase 21 no migration or runtime persistence", () => {
  test("no phase 21 migration file or runtime recorder wiring was added", () => {
    const migrationDirectory = path.join(projectRoot, "backend/db/migrations");
    const migrationNames = readdirSync(migrationDirectory);
    const routesAndRuntimeSource = [
      readSource("backend/routes/admin.ts"),
      readSource("backend/routes/auth.ts"),
      readSource("backend/routes/providerSettings.ts"),
      readSource("backend/routes/credits.ts"),
      readSource("backend/routes/billing.ts"),
      readSource("backend/routes/generation.ts"),
      readSource("backend/routes/exports.ts"),
      readSource("backend/routes/projectHistory.ts"),
      readSource("backend/composition/backendDependencies.ts"),
      readSource("backend/app.ts"),
    ].join("\n");
    const schemaDraft = readSource(
      "backend/db/migrations/0001_initial_supabase_postgres_schema.sql",
    );

    expect(migrationNames.some((name) => name.toLowerCase().includes("phase21"))).toBe(
      false,
    );
    expect(migrationNames.some((name) => name.includes("analytics_events"))).toBe(false);
    expect(migrationNames.some((name) => name.includes("audit_log"))).toBe(false);
    expect(schemaDraft).not.toContain("create table if not exists analytics_events");
    expect(schemaDraft).not.toContain("create table if not exists audit_log");
    expect(routesAndRuntimeSource).not.toContain("appendEvent(");
    expect(routesAndRuntimeSource).not.toContain("appendAuditRecord(");
    expect(routesAndRuntimeSource).not.toContain("createNotConfiguredEventRecorder(");
    expect(routesAndRuntimeSource).not.toContain("createNotConfiguredAuditTrailRecorder(");
  });
});
