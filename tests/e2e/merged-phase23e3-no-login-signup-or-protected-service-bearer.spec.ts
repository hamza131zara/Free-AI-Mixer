import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe(
  "merged phase 23E-3 no login signup or protected service bearer expansion",
  () => {
    test("login signup and protected services remain unchanged by the bridge", () => {
      const unchangedRuntimeSources = [
        readSource("src/pages/LoginPage.tsx"),
        readSource("src/pages/SignupPage.tsx"),
        readSource("src/components/ProtectedRouteShell.tsx"),
        readSource("src/services/projectLibraryService.ts"),
        readSource("src/services/providerSettingsService.ts"),
        readSource("src/services/creditsService.ts"),
        readSource("src/services/exportHistoryService.ts"),
      ].join("\n");

      expect(unchangedRuntimeSources).not.toContain("supabaseAuthSessionBridge");
      expect(unchangedRuntimeSources).not.toContain("supabaseAuthClient");
      expect(unchangedRuntimeSources).not.toContain("Authorization");
      expect(unchangedRuntimeSources).not.toContain("Bearer ");
      expect(unchangedRuntimeSources).toContain(
        "Login and signup are not live in this product phase.",
      );
    });
  },
);
