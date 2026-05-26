import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 23E-1 no runtime auth expansion", () => {
  test("frontend auth remains backend-authoritative and no bearer bridge was added", () => {
    const frontendAuthSources = [
      readSource("src/services/authService.ts"),
      readSource("src/store/authStore.ts"),
      readSource("src/pages/LoginPage.tsx"),
      readSource("src/pages/SignupPage.tsx"),
      readSource("src/components/ProtectedRouteShell.tsx"),
      readSource("src/services/projectLibraryService.ts"),
      readSource("src/services/providerSettingsService.ts"),
      readSource("src/services/creditsService.ts"),
      readSource("src/services/exportHistoryService.ts"),
    ].join("\n");

    expect(frontendAuthSources).toContain('"/auth/session"');
    expect(frontendAuthSources).toContain('"/auth/login"');
    expect(frontendAuthSources).toContain('"/auth/signup"');
    expect(frontendAuthSources).toContain('"/auth/logout"');
    expect(frontendAuthSources).toContain("Checking backend session status.");
    expect(frontendAuthSources).toContain("Login and signup are not live in this product phase.");
    expect(frontendAuthSources).not.toContain("Authorization");
    expect(frontendAuthSources).not.toContain("Bearer ");
    expect(frontendAuthSources).not.toContain("fakeUser");
    expect(frontendAuthSources).not.toContain("fakeSession");
    expect(frontendAuthSources).not.toContain("fakeWorkspace");
    expect(frontendAuthSources).not.toContain("@supabase/supabase-js");
    expect(frontendAuthSources).not.toContain("createClient(");
    expect(frontendAuthSources).not.toContain("onAuthStateChange");
  });
});
