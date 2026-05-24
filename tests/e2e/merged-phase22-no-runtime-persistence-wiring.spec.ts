import { expect, test } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 22 no runtime persistence wiring", () => {
  test("migration draft stays unexecuted and runtime defaults remain no-op", () => {
    const roadmap = readSource("docs/roadmap.md");
    const strategyDoc = readSource("docs/event-audit-persistence-strategy.md");
    const runtimeSources = [
      readSource("backend/composition/backendDependencies.ts"),
      readSource("backend/app.ts"),
      readSource("backend/observability/notConfiguredEventRecorder.ts"),
      readSource("backend/observability/notConfiguredAuditTrailRecorder.ts"),
    ].join("\n");
    const repositoryNames = readdirSync(path.join(projectRoot, "backend/repositories"));

    expect(roadmap).toContain("Phase 22 Recommendation");
    expect(roadmap).toContain("Do not execute migrations");
    expect(strategyDoc).toContain("intentionally not executed by default");
    expect(strategyDoc).toContain("add route or worker event hooks");
    expect(strategyDoc).toContain("route hook audit");
    expect(strategyDoc).toContain("worker hook audit");
    expect(runtimeSources).not.toContain("analyticsEventRepository");
    expect(runtimeSources).not.toContain("auditLogRepository");
    expect(runtimeSources).not.toContain("appendEvent(");
    expect(runtimeSources).not.toContain("appendAuditRecord(");
    expect(runtimeSources).toContain('kind: "event_recorder_not_configured"');
    expect(runtimeSources).toContain('kind: "audit_trail_not_configured"');
    expect(
      repositoryNames.some(
        (name) =>
          /analytics|audit/i.test(name) &&
          name !== "repositoryContracts.ts",
      ),
    ).toBe(false);
  });
});
