import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "backend",
  "db",
  "migrations",
  "0001_initial_supabase_postgres_schema.sql",
);

const packageJsonPath = path.join(process.cwd(), "package.json");
const appSourcePath = path.join(process.cwd(), "backend", "app.ts");
const routeSourcePath = path.join(process.cwd(), "backend", "routes", "exports.ts");
const clientFactorySourcePath = path.join(
  process.cwd(),
  "backend",
  "db",
  "supabaseClientFactory.ts",
);

const readMigration = async (): Promise<string> =>
  fs.readFile(migrationPath, "utf8");

test.describe("phase27 migration draft", () => {
  test("migration file exists under backend db migrations", async () => {
    const stat = await fs.stat(migrationPath);

    expect(stat.isFile()).toBeTruthy();
  });

  test("includes all required tables and migration draft comments", async () => {
    const migration = await readMigration();

    expect(migration).toContain("-- Phase 27-B migration draft only.");
    expect(migration).toContain("not executed by this phase");
    expect(migration).toContain("create table if not exists app_users");
    expect(migration).toContain("create table if not exists workspaces");
    expect(migration).toContain("create table if not exists workspace_memberships");
    expect(migration).toContain("create table if not exists export_jobs");
    expect(migration).toContain("create table if not exists artifact_records");
    expect(migration).toContain("create table if not exists storage_refs");
    expect(migration).toContain("create table if not exists provider_keys");
    expect(migration).toContain("create table if not exists credit_ledger");
  });

  test("preserves key ownership and idempotency constraints", async () => {
    const migration = await readMigration();

    expect(migration).toContain("unique (auth_provider, auth_subject)");
    expect(migration).toContain("check (role in ('owner', 'admin', 'editor', 'viewer'))");
    expect(migration).toContain("check (status in ('active', 'invited', 'disabled'))");
    expect(migration).toContain("unique (workspace_id, owner_id, request_id)");
    expect(migration).toContain("unique (job_id, artifact_id)");
    expect(migration).toContain(
      "create unique index if not exists credit_ledger_workspace_idempotency_key_unique",
    );
  });

  test("preserves provider key encryption placeholder and excludes plaintext secret naming", async () => {
    const migration = await readMigration();

    expect(migration).toContain("encrypted_payload text not null");
    expect(migration).toContain("check (status in ('active', 'disabled', 'rotated'))");
    expect(migration).not.toContain("plaintext_secret");
    expect(migration).not.toContain("provider_secret");
    expect(migration).not.toContain("api_key text");
  });

  test("preserves credit ledger semantics", async () => {
    const migration = await readMigration();

    expect(migration).toContain(
      "check (entry_kind in ('reserve', 'charge', 'refund', 'grant', 'adjustment'))",
    );
    expect(migration).toContain("check (amount_delta <> 0)");
    expect(migration).toContain("reservation_entry_id uuid references credit_ledger(ledger_entry_id)");
    expect(migration).toContain("charge_entry_id uuid references credit_ledger(ledger_entry_id)");
  });

  test("does not include local path persistence or durable signed url fields", async () => {
    const migration = await readMigration();

    expect(migration).toContain("storage_provider text not null");
    expect(migration).toContain("object_key text not null");
    expect(migration).not.toContain("file_path");
    expect(migration).not.toContain("root_path");
    expect(migration).not.toContain("directory_path");
    expect(migration).not.toContain("signed_url text");
    expect(migration).not.toContain("signed_url varchar");
  });

  test("stays phase30-aware and keeps migration safety separate from runtime code", async () => {
    const [migration, packageJson, appSource, routeSource, clientFactorySource] =
      await Promise.all([
        readMigration(),
        fs.readFile(packageJsonPath, "utf8"),
        fs.readFile(appSourcePath, "utf8"),
        fs.readFile(routeSourcePath, "utf8"),
        fs.readFile(clientFactorySourcePath, "utf8"),
      ]);

    expect(migration).not.toContain("createClient(");
    expect(migration).not.toContain("Authorization");
    expect(migration).not.toContain("window.");
    expect(migration).not.toContain("fetch(");
    expect(migration).not.toContain("@supabase/supabase-js");
    expect(packageJson).toContain("@supabase/supabase-js");
    expect(packageJson).not.toContain("\"supabase migration\"");
    expect(packageJson).not.toContain("\"supabase db push\"");
    expect(packageJson).not.toContain("\"supabase db reset\"");
    expect(appSource).not.toContain("migrate(");
    expect(appSource).not.toContain("supabase db push");
    expect(routeSource).not.toContain("migrate(");
    expect(routeSource).not.toContain("supabase db push");
    expect(clientFactorySource).not.toContain("migrate(");
    expect(clientFactorySource).not.toContain("supabase db push");
  });
});
