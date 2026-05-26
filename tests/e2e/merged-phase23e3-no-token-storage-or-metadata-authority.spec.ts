import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 23E-3 no token storage or metadata authority", () => {
  test("bridge keeps tokens ephemeral and avoids frontend metadata authority", () => {
    const authBoundaryFiles = [
      "src/services/auth/supabaseAuthClient.ts",
      "src/services/auth/supabaseAuthSessionBridge.ts",
      "src/services/authService.ts",
      "src/store/authStore.ts",
      "src/pages/LoginPage.tsx",
      "src/pages/SignupPage.tsx",
      "src/components/ProtectedRouteShell.tsx",
    ];
    const frontendSource = authBoundaryFiles
      .map((relativePath) => readSource(relativePath))
      .join("\n");
    const bridgeAndStoreSource = [
      readSource("src/services/auth/supabaseAuthSessionBridge.ts"),
      readSource("src/store/authStore.ts"),
    ].join("\n");

    expect(frontendSource).not.toContain("localStorage.setItem(\"auth");
    expect(frontendSource).not.toContain("localStorage.setItem('auth");
    expect(frontendSource).not.toContain("sessionStorage.setItem(\"auth");
    expect(frontendSource).not.toContain("sessionStorage.setItem('auth");
    expect(frontendSource).not.toContain("persist(");
    expect(frontendSource).not.toContain("createJSONStorage(");

    expect(bridgeAndStoreSource).not.toContain("accessToken:");
    expect(bridgeAndStoreSource).not.toContain("refresh_token");
    expect(bridgeAndStoreSource).not.toContain("user_metadata");
    expect(bridgeAndStoreSource).not.toContain("app_metadata");
    expect(bridgeAndStoreSource).not.toContain("platformRole");
  });
});
