import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("product phase 21 rls access strategy boundary", () => {
  test("strategy docs require default-deny rls and backend-only access", () => {
    const strategyDoc = readSource("docs/event-audit-persistence-strategy.md");

    expect(strategyDoc).toContain("default-deny RLS");
    expect(strategyDoc).toContain("backend-only writes");
    expect(strategyDoc).toContain("no direct frontend reads");
    expect(strategyDoc).toContain("no frontend Supabase client access");
    expect(strategyDoc).toContain("workspace owner/admin must never read platform audit logs");
    expect(strategyDoc).toContain("moderator and support roles need narrow backend routes later");
  });
});
