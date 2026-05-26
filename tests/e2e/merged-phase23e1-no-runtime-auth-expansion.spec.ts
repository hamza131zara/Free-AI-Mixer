import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 23E-1 no runtime auth expansion", () => {
  test("frontend auth remains backend-authoritative and selected bearer stays tightly scoped", () => {
    const authServiceSource = readSource("src/services/authService.ts");
    const authenticatedFetchSource = readSource("src/services/auth/authenticatedFetch.ts");
    const frontendAuthSources = [
      readSource("src/store/authStore.ts"),
      readSource("src/pages/LoginPage.tsx"),
      readSource("src/pages/SignupPage.tsx"),
      readSource("src/components/ProtectedRouteShell.tsx"),
      readSource("src/services/projectLibraryService.ts"),
      readSource("src/services/providerSettingsService.ts"),
      readSource("src/services/creditsService.ts"),
      readSource("src/services/exportHistoryService.ts"),
    ].join("\n");

    expect(authServiceSource).toContain('"/auth/session"');
    expect(authServiceSource).toContain('"/auth/login"');
    expect(authServiceSource).toContain('"/auth/signup"');
    expect(authServiceSource).toContain('"/auth/logout"');
    expect(authServiceSource).toContain("Authorization");
    expect(authServiceSource).toContain("Bearer ${trimmedToken}");
    expect(authenticatedFetchSource).toContain("/project-library/projects");
    expect(authenticatedFetchSource).toContain("/project-library/history");
    expect(authenticatedFetchSource).toContain("/provider-settings/status");
    expect(authenticatedFetchSource).toContain("/credits/status");
    expect(frontendAuthSources).toContain("Checking backend session status.");
    expect(frontendAuthSources).toContain("No fake user, fake session, or frontend-owned workspace is created in this route.");
    expect(frontendAuthSources).not.toContain("Authorization");
    expect(frontendAuthSources).not.toContain("Authorization: Bearer");
    expect(frontendAuthSources).not.toContain("fakeUser");
    expect(frontendAuthSources).not.toContain("fakeSession");
    expect(frontendAuthSources).not.toContain("fakeWorkspace");
    expect(frontendAuthSources).not.toContain("@supabase/supabase-js");
    expect(frontendAuthSources).not.toContain("createClient(");
    expect(frontendAuthSources).not.toContain("onAuthStateChange");
  });
});
