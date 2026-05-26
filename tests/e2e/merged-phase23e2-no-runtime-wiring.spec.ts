import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 23E-2 no runtime wiring", () => {
  test("wrapper is not connected to login signup auth store or protected runtime", () => {
    const runtimeSources = [
      readSource("src/pages/LoginPage.tsx"),
      readSource("src/pages/SignupPage.tsx"),
      readSource("src/store/authStore.ts"),
      readSource("src/services/authService.ts"),
      readSource("src/components/ProtectedRouteShell.tsx"),
      readSource("src/App.tsx"),
      readSource("src/main.tsx"),
      readSource("src/services/projectLibraryService.ts"),
      readSource("src/services/providerSettingsService.ts"),
      readSource("src/services/creditsService.ts"),
      readSource("src/services/exportHistoryService.ts"),
    ].join("\n");

    expect(runtimeSources).not.toContain("supabaseAuthClient");
    expect(runtimeSources).not.toContain("@supabase/supabase-js");
    expect(runtimeSources).not.toContain("signInWithPassword");
    expect(runtimeSources).not.toContain("signUp(");
    expect(runtimeSources).not.toContain("signOut(");
    expect(runtimeSources).not.toContain("getSession(");
    expect(runtimeSources).not.toContain("onAuthStateChange");
  });
});
