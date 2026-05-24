import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 22 no route or worker hooks", () => {
  test("routes and workers remain unwired to event and audit persistence", () => {
    const sources = [
      readSource("backend/routes/admin.ts"),
      readSource("backend/routes/auth.ts"),
      readSource("backend/routes/providerSettings.ts"),
      readSource("backend/routes/credits.ts"),
      readSource("backend/routes/billing.ts"),
      readSource("backend/routes/generation.ts"),
      readSource("backend/routes/exports.ts"),
      readSource("backend/routes/projectHistory.ts"),
      readSource("backend/routes/monitoring.ts"),
      readSource("backend/workers/renderWorker.ts"),
      readSource("backend/workers/renderWorkerLifecycle.ts"),
      readSource("backend/workers/renderWorkerStartup.ts"),
    ].join("\n");

    expect(sources).not.toContain("eventRecorder");
    expect(sources).not.toContain("auditTrailRecorder");
    expect(sources).not.toContain("appendEvent(");
    expect(sources).not.toContain("appendAuditRecord(");
    expect(sources).not.toContain("createNotConfiguredEventRecorder(");
    expect(sources).not.toContain("createNotConfiguredAuditTrailRecorder(");
  });
});
