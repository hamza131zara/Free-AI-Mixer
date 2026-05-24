import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 22 RLS default deny boundary", () => {
  test("migration draft enables RLS without permissive anon/authenticated policies", () => {
    const migrationDraft = readSource(
      "backend/db/migrations/0002_event_audit_persistence_draft.sql",
    );
    const strategyDoc = readSource("docs/event-audit-persistence-strategy.md");

    expect(migrationDraft).toContain("alter table analytics_events enable row level security");
    expect(migrationDraft).toContain("alter table audit_log enable row level security");
    expect(migrationDraft).not.toContain("create policy");
    expect(migrationDraft).not.toContain("to authenticated");
    expect(migrationDraft).not.toContain("to anon");
    expect(strategyDoc).toContain("default-deny RLS");
    expect(strategyDoc).toContain("no direct frontend reads");
    expect(strategyDoc).toContain("the migration draft enables RLS on both tables");
    expect(strategyDoc).toContain("it creates no permissive anon or authenticated client policies");
  });
});
