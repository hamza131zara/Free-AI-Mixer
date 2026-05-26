import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 23E-1 no custom token storage", () => {
  test("auth-related frontend files avoid token persistence and zustand auth persistence", () => {
    const authBoundarySources = [
      readSource("src/services/authService.ts"),
      readSource("src/store/authStore.ts"),
      readSource("src/pages/LoginPage.tsx"),
      readSource("src/pages/SignupPage.tsx"),
      readSource("src/components/ProtectedRouteShell.tsx"),
    ].join("\n");

    expect(authBoundarySources).not.toContain("persist(");
    expect(authBoundarySources).not.toContain("createJSONStorage(");
    expect(authBoundarySources).not.toContain("localStorage.setItem");
    expect(authBoundarySources).not.toContain("sessionStorage.setItem");
    expect(authBoundarySources).not.toContain("access_token");
    expect(authBoundarySources).not.toContain("refresh_token");
    expect(authBoundarySources).not.toContain("bearerToken");
  });
});
