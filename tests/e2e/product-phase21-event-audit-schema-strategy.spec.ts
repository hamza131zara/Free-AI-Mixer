import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("product phase 21 event audit schema strategy", () => {
  test("strategy docs describe separate analytics_events and audit_log tables", () => {
    const strategyDoc = readSource("docs/event-audit-persistence-strategy.md");
    const roadmap = readSource("docs/roadmap.md");

    expect(strategyDoc).toContain("analytics_events");
    expect(strategyDoc).toContain("audit_log");
    expect(strategyDoc).toContain("metadata_safe_json jsonb not null");
    expect(strategyDoc).toContain("append-only later");
    expect(strategyDoc).toContain("the schema may support future aggregation");
    expect(strategyDoc).toContain("must not enable analytics");
    expect(roadmap).toContain("Phase 21 Recommendation");
    expect(roadmap).toContain("schema-strategy-only");
  });
});
