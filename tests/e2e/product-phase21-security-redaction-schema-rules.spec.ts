import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("product phase 21 security redaction schema rules", () => {
  test("strategy docs forbid storing secrets prompts signed urls and local paths", () => {
    const strategyDoc = readSource("docs/event-audit-persistence-strategy.md");
    const sanitizerSource = readSource("backend/observability/safeEventSanitizer.ts");

    for (const marker of [
      "raw API keys",
      "encrypted provider payloads",
      "raw prompts by default",
      "JWTs",
      "cookies or session tokens",
      "service-role values",
      "billing secrets or raw payment details",
      "local file paths",
      "signed URLs",
      "frontend localStorage identity",
    ]) {
      expect(strategyDoc).toContain(marker);
    }

    expect(sanitizerSource).toContain("\"prompt\"");
    expect(sanitizerSource).toContain("\"authorization\"");
    expect(sanitizerSource).toContain("\"cookie\"");
    expect(sanitizerSource).toContain("\"service_role\"");
    expect(sanitizerSource).toContain("\"encrypted_payload\"");
    expect(sanitizerSource).toContain("\"x-user-id\"");
    expect(sanitizerSource).toContain("\"x-workspace-id\"");
  });
});
