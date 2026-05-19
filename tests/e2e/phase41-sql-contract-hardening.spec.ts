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

const schemaPath = path.join(
  process.cwd(),
  "backend",
  "db",
  "schema",
  "phase26-initial-supabase-postgres-schema.sql",
);

const readSqlFiles = async (): Promise<string[]> =>
  Promise.all([
    fs.readFile(migrationPath, "utf8"),
    fs.readFile(schemaPath, "utf8"),
  ]);

const expectedStatusCheck =
  "check (status in ('queued', 'submitted', 'rendering', 'finalizing', 'success', 'error', 'expired'))";

const forbiddenTokens = [
  "running",
  "completed",
  "failed",
  "cancelled",
  "artifact_record_id",
  "gen_random_uuid",
  "artifact_records_status_check",
  "artifact_records_kind_check",
  "artifact_records_format_check",
  "storage_refs_bucket_object_key_unique",
  "set_updated_at",
];

const getArtifactRecordsTableBlock = (sql: string): string => {
  const match = sql.match(
    /create table if not exists artifact_records \(([\s\S]*?)\n\);/,
  );

  expect(match).not.toBeNull();
  return match?.[0] ?? "";
};

test.describe("phase41 sql contract hardening", () => {
  test("both SQL files add the contract-aligned export job status check", async () => {
    const sqlFiles = await readSqlFiles();

    for (const sql of sqlFiles) {
      expect(sql).toContain("constraint export_jobs_status_check");
      expect(sql).toContain(expectedStatusCheck);
    }
  });

  test("both SQL files use only the approved persisted export lifecycle statuses", async () => {
    const sqlFiles = await readSqlFiles();

    for (const sql of sqlFiles) {
      expect(sql).toContain("'queued'");
      expect(sql).toContain("'submitted'");
      expect(sql).toContain("'rendering'");
      expect(sql).toContain("'finalizing'");
      expect(sql).toContain("'success'");
      expect(sql).toContain("'error'");
      expect(sql).toContain("'expired'");
      expect(sql).not.toContain("'running'");
      expect(sql).not.toContain("'completed'");
      expect(sql).not.toContain("'failed'");
      expect(sql).not.toContain("'cancelled'");
    }
  });

  test("both SQL files promote artifact_records identity to a composite primary key", async () => {
    const sqlFiles = await readSqlFiles();

    for (const sql of sqlFiles) {
      const artifactRecordsTable = getArtifactRecordsTableBlock(sql);

      expect(artifactRecordsTable).toContain(
        "constraint artifact_records_pkey primary key (job_id, artifact_id)",
      );
      expect(artifactRecordsTable).not.toContain("artifact_records_job_artifact_unique");
      expect(artifactRecordsTable).not.toContain("unique (job_id, artifact_id)");
    }
  });

  test("both SQL files exclude deferred hardening that was not approved", async () => {
    const sqlFiles = await readSqlFiles();

    for (const sql of sqlFiles) {
      for (const token of forbiddenTokens) {
        expect(sql).not.toContain(token);
      }
    }
  });
});
