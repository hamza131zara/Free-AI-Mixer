import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 22 event audit migration draft", () => {
  test("migration draft exists and contains the safe event and audit schema", () => {
    const migrationDraft = readSource(
      "backend/db/migrations/0002_event_audit_persistence_draft.sql",
    );

    expect(migrationDraft).toContain("create table if not exists analytics_events");
    expect(migrationDraft).toContain("create table if not exists audit_log");
    expect(migrationDraft).toContain("metadata_safe_json jsonb not null");
    expect(migrationDraft).toContain("request_id text");
    expect(migrationDraft).toContain("event_category in (");
    expect(migrationDraft).toContain("'auth_account'");
    expect(migrationDraft).toContain("'generation_export'");
    expect(migrationDraft).toContain("'operational_error'");
    expect(migrationDraft).toContain("audit_category in (");
    expect(migrationDraft).toContain("'auth_security'");
    expect(migrationDraft).toContain("'admin_access'");
    expect(migrationDraft).toContain("'support_moderation_action'");
    expect(migrationDraft).toContain("outcome in (");
    expect(migrationDraft).toContain("'accepted'");
    expect(migrationDraft).toContain("'skipped'");
    expect(migrationDraft).not.toContain("raw_email");
    expect(migrationDraft).not.toContain("authorization_header");
    expect(migrationDraft).not.toContain("provider_secret");
    expect(migrationDraft).not.toContain("raw_payload");
  });
});
