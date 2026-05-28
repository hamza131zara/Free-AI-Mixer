import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createAuthRuntimeService } from "../../src/services/auth/authRuntimeService";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("phase27 password reset source boundary", () => {
  test("password reset stays inside the auth-only Supabase wrapper and fails closed", async () => {
    const wrapperSource = readSource("src/services/auth/supabaseAuthClient.ts");
    const runtimeSource = readSource("src/services/auth/authRuntimeService.ts");
    const frontendSource = [
      wrapperSource,
      runtimeSource,
      readSource("src/pages/ForgotPasswordPage.tsx"),
      readSource("src/pages/ResetPasswordPage.tsx"),
      readSource("src/store/authStore.ts"),
    ].join("\n");

    expect(wrapperSource).toContain("requestPasswordReset");
    expect(wrapperSource).toContain("resetPasswordForEmail");
    expect(wrapperSource).toContain("updatePassword");
    expect(wrapperSource).toContain("updateUser");
    expect(frontendSource).not.toContain(".from(");
    expect(frontendSource).not.toContain(".storage");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain("localStorage.setItem");
    expect(frontendSource).not.toContain("sessionStorage.setItem");
    expect(frontendSource).not.toContain("refresh_token");
    expect(frontendSource).not.toContain("rawUser");
    expect(frontendSource).not.toContain("user_metadata");
    expect(frontendSource).not.toContain("app_metadata");
    expect(frontendSource).not.toContain("console.log");

    const service = createAuthRuntimeService({
      bootstrapAccount: async () => undefined,
      getAuthSession: async () => ({
        kind: "unauthenticated",
        status: "unauthenticated",
        reason: "missing_credentials",
        message: "Sign in is required.",
      }),
      getSupabaseAuthClient: () => ({
        kind: "supabase_auth_client_disabled",
        reason: "missing_supabase_url",
      }),
      logoutFromBackendAuth: async () => ({
        kind: "logged_out",
        status: "unauthenticated",
        message: "Session cleared.",
      }),
    });

    await expect(
      service.requestPasswordResetWithSupabaseRuntime({
        email: "tester@example.com",
      }),
    ).resolves.toMatchObject({
      code: "supabase_auth_not_configured",
      kind: "unavailable",
      status: "unavailable",
    });
  });
});
