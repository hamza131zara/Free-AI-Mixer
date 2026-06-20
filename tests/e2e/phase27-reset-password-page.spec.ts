import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createAuthRuntimeService } from "../../src/services/auth/authRuntimeService";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("phase27 reset password page", () => {
  test("reset password updates through Supabase Auth then requires a fresh login", async () => {
    const resetPageSource = readSource("src/pages/ResetPasswordPage.tsx");
    let updatePasswordCalls = 0;
    let signOutCalls = 0;
    let backendLogoutCalls = 0;

    const service = createAuthRuntimeService({
      bootstrapAccount: async () => undefined,
      getAuthSession: async () => ({
        kind: "unauthenticated",
        status: "unauthenticated",
        reason: "missing_credentials",
        message: "Sign in is required.",
      }),
      getSupabaseAuthClient: () => ({
        kind: "supabase_auth_client_ready",
        auth: {
          getAccessToken: async () => ({ ok: true, data: undefined }),
          getSession: async () => ({
            ok: true,
            data: { hasSession: true },
          }),
          onAuthStateChange: () => ({ unsubscribe() {} }),
          signInWithPassword: async () => ({
            ok: true,
            data: { hasSession: true },
          }),
          signOut: async () => {
            signOutCalls += 1;
            return { ok: true, data: undefined };
          },
          signUp: async () => ({
            ok: true,
            data: { hasSession: false },
          }),
          requestPasswordReset: async () => ({ ok: true, data: undefined }),
          updatePassword: async () => {
            updatePasswordCalls += 1;
            return { ok: true, data: undefined };
          },
        },
      }),
      logoutFromBackendAuth: async () => {
        backendLogoutCalls += 1;
        return {
          kind: "logged_out",
          status: "unauthenticated",
          message: "Backend session cleared.",
        };
      },
    });

    await expect(
      service.updatePasswordWithSupabaseRuntime("new-password-123"),
    ).resolves.toEqual({
      kind: "logged_out",
      status: "unauthenticated",
      message: "Password updated. Sign in again to continue.",
      recoveryStatus: "recovery_complete",
    });
    expect(updatePasswordCalls).toBe(1);
    expect(signOutCalls).toBe(1);
    expect(backendLogoutCalls).toBe(1);
    expect(resetPageSource).toContain("store reset tokens");
    expect(resetPageSource).toContain("sign in again");
    expect(resetPageSource).not.toContain('status: "authenticated"');
  });
});
