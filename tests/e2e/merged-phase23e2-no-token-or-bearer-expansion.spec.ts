import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 23E-2 no token or bearer expansion", () => {
  test("wrapper and bridge phases add no token persistence and keep bearer scoped to auth session only", () => {
    const authServiceSource = readSource("src/services/authService.ts");
    const frontendSources = [
      readSource("src/services/auth/supabaseAuthClient.ts"),
      readSource("src/store/authStore.ts"),
      readSource("src/services/projectLibraryService.ts"),
      readSource("src/services/providerSettingsService.ts"),
      readSource("src/services/creditsService.ts"),
      readSource("src/services/exportHistoryService.ts"),
    ].join("\n");

    expect(frontendSources).not.toContain("localStorage.setItem");
    expect(frontendSources).not.toContain("sessionStorage.setItem");
    expect(frontendSources).not.toContain("persist(");
    expect(frontendSources).not.toContain("createJSONStorage(");
    expect(authServiceSource).toContain("Authorization");
    expect(authServiceSource).toContain("Bearer ${trimmedToken}");
    expect(frontendSources).not.toContain("Authorization");
    expect(frontendSources).not.toContain("Bearer ");
    expect(frontendSources).not.toContain("bearerToken");
    expect(frontendSources).not.toContain("refresh_token");
  });
});
