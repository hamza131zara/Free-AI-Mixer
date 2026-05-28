import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("phase27 dashboard account status", () => {
  test("dashboard account status is backend-derived and avoids metadata authority", () => {
    const dashboardSource = readSource("src/pages/DashboardPage.tsx");
    const authStoreSource = readSource("src/store/authStore.ts");

    expect(dashboardSource).toContain("dashboard-account-status-panel");
    expect(dashboardSource).toContain("Backend account status");
    expect(dashboardSource).toContain("identity?.email");
    expect(dashboardSource).toContain("identity?.workspaceId");
    expect(dashboardSource).toContain("backend /auth/session identity only");
    expect(dashboardSource).toContain("Retry account setup");
    expect(dashboardSource).toContain("Refresh session");
    expect(dashboardSource).toContain("Log out");
    expect(dashboardSource).not.toContain("user_metadata");
    expect(dashboardSource).not.toContain("app_metadata");
    expect(dashboardSource).not.toContain("platform_admin");
    expect(authStoreSource).toContain("refreshSession");
    expect(authStoreSource).toContain("retryAccountBootstrap");
  });
});
