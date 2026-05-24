import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("product phase 21 audit append-only contract", () => {
  test("docs and repository contracts preserve append-only audit semantics", () => {
    const strategyDoc = readSource("docs/event-audit-persistence-strategy.md");
    const repositoryContracts = readSource("backend/repositories/repositoryContracts.ts");

    expect(strategyDoc).toContain("append-only later");
    expect(strategyDoc).toContain("no update or delete methods");
    expect(repositoryContracts).toContain("export interface BackendAuditLogRepository");
    expect(repositoryContracts).toContain("appendAuditRecord(");
    expect(repositoryContracts).not.toContain("updateAudit");
    expect(repositoryContracts).not.toContain("deleteAudit");
    expect(repositoryContracts).not.toContain("removeAudit");
  });
});
