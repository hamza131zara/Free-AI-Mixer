import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("phase30 account menu boundary", () => {
  test("account navigation uses backend-derived email only and keeps logout safe", () => {
    const navigationSource = readSource("src/components/AppNavigation.tsx");

    expect(navigationSource).toContain("account-nav-identity");
    expect(navigationSource).toContain("identity?.email");
    expect(navigationSource).toContain('navigateTo("/dashboard")');
    expect(navigationSource).toContain('navigateTo("/settings/providers")');
    expect(navigationSource).toContain('navigateTo("/credits")');
    expect(navigationSource).toContain('navigateTo("/help")');
    expect(navigationSource).toContain('useAuthStore.getState().status === "unauthenticated"');
    expect(navigationSource).toContain('navigateTo("/login")');
    expect(navigationSource).not.toContain("user_metadata");
    expect(navigationSource).not.toContain("app_metadata");
    expect(navigationSource).not.toContain("avatar");
    expect(navigationSource).not.toContain("profile");
    expect(navigationSource).not.toContain("platform_admin");
  });
});
