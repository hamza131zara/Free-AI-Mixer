import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("phase30 login redirect", () => {
  test("login redirects only after backend-authenticated authStore state", () => {
    const loginSource = readSource("src/pages/LoginPage.tsx");
    const authStoreSource = readSource("src/store/authStore.ts");

    expect(loginSource).toContain("void login({ email, password }).then");
    expect(loginSource).toContain('useAuthStore.getState().status === "authenticated"');
    expect(loginSource).toContain('navigateTo("/dashboard")');
    expect(loginSource).not.toContain("signInWithPassword");
    expect(loginSource).not.toContain("accessToken");
    expect(loginSource).not.toContain("user_metadata");
    expect(loginSource).not.toContain("app_metadata");
    expect(authStoreSource).not.toContain('navigateTo("/dashboard")');
  });
});
