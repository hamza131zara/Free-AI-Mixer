import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

const schemaPath = path.join(
  process.cwd(),
  "backend",
  "db",
  "schema",
  "phase26-initial-supabase-postgres-schema.sql",
);

const readSchema = async (): Promise<string> =>
  fs.readFile(schemaPath, "utf8");

test.describe("phase26 schema draft", () => {
  test("includes all required tables", async () => {
    const schema = await readSchema();

    expect(schema).toContain("create table if not exists app_users");
    expect(schema).toContain("create table if not exists workspaces");
    expect(schema).toContain("create table if not exists workspace_memberships");
    expect(schema).toContain("create table if not exists export_jobs");
    expect(schema).toContain("create table if not exists artifact_records");
    expect(schema).toContain("create table if not exists storage_refs");
    expect(schema).toContain("create table if not exists provider_keys");
    expect(schema).toContain("create table if not exists credit_ledger");
  });

  test("includes workspace membership role and status constraints", async () => {
    const schema = await readSchema();

    expect(schema).toContain("check (role in ('owner', 'admin', 'editor', 'viewer'))");
    expect(schema).toContain("check (status in ('active', 'invited', 'disabled'))");
    expect(schema).toContain("primary key (workspace_id, user_id)");
  });

  test("includes export job ownership and idempotency constraints", async () => {
    const schema = await readSchema();

    expect(schema).toContain("owner_id uuid not null references app_users(id)");
    expect(schema).toContain("workspace_id uuid not null references workspaces(id)");
    expect(schema).toContain("unique (workspace_id, owner_id, request_id)");
    expect(schema).toContain("create index if not exists export_jobs_workspace_owner_status_idx");
  });

  test("includes provider key encrypted payload shape and excludes plaintext secret naming", async () => {
    const schema = await readSchema();

    expect(schema).toContain("encrypted_payload text not null");
    expect(schema).toContain("check (status in ('active', 'disabled', 'rotated'))");
    expect(schema).not.toContain("plaintext_secret");
    expect(schema).not.toContain("provider_secret");
    expect(schema).not.toContain("api_key text");
  });

  test("includes append-only credit ledger semantics", async () => {
    const schema = await readSchema();

    expect(schema).toContain(
      "check (entry_kind in ('reserve', 'charge', 'refund', 'grant', 'adjustment'))",
    );
    expect(schema).toContain("check (amount_delta <> 0)");
    expect(schema).toContain("reservation_entry_id uuid references credit_ledger(ledger_entry_id)");
    expect(schema).toContain("charge_entry_id uuid references credit_ledger(ledger_entry_id)");
    expect(schema).toContain(
      "create unique index if not exists credit_ledger_workspace_idempotency_key_unique",
    );
  });

  test("preserves artifact and storage ownership without local path persistence or durable signed urls", async () => {
    const schema = await readSchema();

    expect(schema).toContain("artifact_id text not null");
    expect(schema).toContain("job_id uuid not null references export_jobs(job_id) on delete cascade");
    expect(schema).toContain("workspace_id uuid not null references workspaces(id)");
    expect(schema).toContain("storage_provider text not null");
    expect(schema).toContain("object_key text not null");
    expect(schema).not.toContain("file_path");
    expect(schema).not.toContain("root_path");
    expect(schema).not.toContain("directory_path");
    expect(schema).not.toContain("signed_url text");
    expect(schema).not.toContain("signed_url varchar");
  });

  test("schema draft stays boundary only and does not add runtime code", async () => {
    const schema = await readSchema();

    expect(schema).not.toContain("createClient(");
    expect(schema).not.toContain("Authorization");
    expect(schema).not.toContain("fetch(");
    expect(schema).not.toContain("window.");
    expect(schema).not.toContain("FREE_AI_MIXER_ENABLE_LOCAL_DEV_ARTIFACT_STREAM");
  });
});
