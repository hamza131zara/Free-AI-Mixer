import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("phase30 no runtime expansion", () => {
  test("phase30 stays frontend ux only without storage backend or product runtime expansion", () => {
    const frontendSource = [
      readSource("src/pages/LoginPage.tsx"),
      readSource("src/pages/DashboardPage.tsx"),
      readSource("src/pages/CreditsPage.tsx"),
      readSource("src/pages/ProviderSettingsPage.tsx"),
      readSource("src/components/AppNavigation.tsx"),
      readSource("src/components/ProtectedRouteShell.tsx"),
      readSource("src/store/authStore.ts"),
      readSource("src/services/auth/supabaseAuthSessionBridge.ts"),
      readSource("src/services/authService.ts"),
      readSource("src/services/auth/supabaseAuthClient.ts"),
    ].join("\n");
    const authStoreSource = readSource("src/store/authStore.ts");
    const sessionBridgeSource = readSource("src/services/auth/supabaseAuthSessionBridge.ts");
    const protectedRouteShellSource = readSource("src/components/ProtectedRouteShell.tsx");
    const backendSource = [
      readSource("backend/routes/auth.ts"),
      readSource("backend/routes/account.ts"),
      readSource("backend/routes/generation.ts"),
      readSource("backend/routes/exports.ts"),
      readSource("backend/routes/admin.ts"),
      readSource("backend/routes/billing.ts"),
      readSource("backend/routes/credits.ts"),
    ].join("\n");
    const viteSource = readSource("vite.config.ts");

    expect(frontendSource).not.toContain("localStorage.setItem");
    expect(frontendSource).not.toContain("sessionStorage.setItem");
    expect(frontendSource).not.toContain("reset_token");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain(".from(");
    expect(frontendSource).not.toContain("platform_admin");
    expect(frontendSource).not.toContain("billing/checkout");
    expect(frontendSource).not.toContain("creditBalance");
    expect(frontendSource).not.toContain("providerApiKey");
    expect(frontendSource).not.toContain("projectCount");
    expect(frontendSource).not.toContain("exportCount");
    expect(authStoreSource).not.toContain("supabase_auth_session_bridge_disabled\") {\n      void useAuthStore.getState().refreshSession()");
    expect(sessionBridgeSource).toContain("initialAccessToken.ok && initialAccessToken.data");
    expect(sessionBridgeSource).toContain("if (sessionSnapshot?.accessToken)");
    expect(protectedRouteShellSource).toContain("authStatus === \"unknown\"");
    expect(protectedRouteShellSource).toContain("void refreshSession()");
    expect(backendSource).not.toContain("resetPasswordForEmail");
    expect(backendSource).not.toContain("appendAuditRecord(");
    expect(backendSource).not.toContain("appendEvent(");
    expect(viteSource).toContain('"/auth"');
    expect(viteSource).toContain('"/account"');
    expect(viteSource).toContain('"/exports"');
  });
});
