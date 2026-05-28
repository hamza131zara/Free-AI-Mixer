import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("phase27 no runtime expansion", () => {
  test("phase27 does not expand backend authority, bearer scope, or product runtimes", () => {
    const frontendSource = [
      readSource("src/services/auth/supabaseAuthClient.ts"),
      readSource("src/services/auth/authRuntimeService.ts"),
      readSource("src/services/auth/authenticatedFetch.ts"),
      readSource("src/services/authService.ts"),
      readSource("src/store/authStore.ts"),
      readSource("src/pages/LoginPage.tsx"),
      readSource("src/pages/ForgotPasswordPage.tsx"),
      readSource("src/pages/ResetPasswordPage.tsx"),
      readSource("src/pages/DashboardPage.tsx"),
      readSource("src/services/projectLibraryService.ts"),
      readSource("src/services/providerSettingsService.ts"),
      readSource("src/services/creditsService.ts"),
      readSource("src/services/exportHistoryService.ts"),
      readSource("src/services/sceneGenerationService.ts"),
      readSource("src/services/exportService.ts"),
      readSource("src/services/billingService.ts"),
    ].join("\n");
    const accountRouteSource = readSource("backend/routes/account.ts");
    const backendSource = [
      accountRouteSource,
      readSource("backend/routes/auth.ts"),
      readSource("backend/routes/generation.ts"),
      readSource("backend/routes/exports.ts"),
      readSource("backend/routes/admin.ts"),
      readSource("backend/routes/billing.ts"),
      readSource("backend/routes/credits.ts"),
    ].join("\n");

    expect(frontendSource).toContain("resetPasswordForEmail");
    expect(frontendSource).toContain("updateUser");
    expect(frontendSource).toContain("/account/bootstrap");
    expect(frontendSource).toContain("/auth/session");
    expect(frontendSource).not.toContain("localStorage.setItem");
    expect(frontendSource).not.toContain("sessionStorage.setItem");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain("user_metadata");
    expect(frontendSource).not.toContain("app_metadata");
    expect(frontendSource).not.toContain("/generation/jobs");
    expect(frontendSource).not.toContain("/exports/");
    expect(frontendSource).not.toContain("/admin/");
    expect(frontendSource).not.toContain("/billing/checkout");
    expect(backendSource).not.toContain("resetPasswordForEmail");
    expect(backendSource).not.toContain("updateUser");
    expect(backendSource).not.toContain("appendAuditRecord(");
    expect(backendSource).not.toContain("appendEvent(");
    expect(accountRouteSource).not.toContain("platform_admin");
  });
});
