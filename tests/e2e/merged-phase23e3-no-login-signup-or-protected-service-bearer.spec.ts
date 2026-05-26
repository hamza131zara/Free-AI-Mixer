import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe(
  "merged phase 23E-3 no login signup or protected service bearer expansion",
  () => {
    test("login signup and protected services keep runtime authority and avoid inline bearer wiring", () => {
      const routeCopySources = [
        readSource("src/pages/LoginPage.tsx"),
        readSource("src/pages/SignupPage.tsx"),
        readSource("src/components/ProtectedRouteShell.tsx"),
      ].join("\n");
      const protectedServiceSources = [
        readSource("src/services/projectLibraryService.ts"),
        readSource("src/services/providerSettingsService.ts"),
        readSource("src/services/creditsService.ts"),
        readSource("src/services/exportHistoryService.ts"),
      ].join("\n");

      expect(routeCopySources).not.toContain("supabaseAuthSessionBridge");
      expect(routeCopySources).not.toContain("supabaseAuthClient");
      expect(routeCopySources).toContain("No fake user, fake session, or frontend-owned workspace is created in this route.");
      expect(protectedServiceSources).not.toContain("Authorization");
      expect(protectedServiceSources).not.toContain("Authorization: Bearer");
    });
  },
);
