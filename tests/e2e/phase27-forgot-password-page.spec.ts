import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createAuthRuntimeService } from "../../src/services/auth/authRuntimeService";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("phase27 forgot password page", () => {
  test("forgot password uses neutral recovery copy and the wrapper reset method", async () => {
    const pageSource = readSource("src/pages/ForgotPasswordPage.tsx");
    const loginSource = readSource("src/pages/LoginPage.tsx");
    let resetRequest: { email: string; redirectTo?: string } | undefined;

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
            data: { hasSession: false },
          }),
          onAuthStateChange: () => ({ unsubscribe() {} }),
          signInWithPassword: async () => ({
            ok: true,
            data: { hasSession: true },
          }),
          signOut: async () => ({ ok: true, data: undefined }),
          signUp: async () => ({
            ok: true,
            data: { hasSession: false },
          }),
          requestPasswordReset: async (input) => {
            resetRequest = input;
            return { ok: true, data: undefined };
          },
          updatePassword: async () => ({ ok: true, data: undefined }),
        },
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
        redirectTo: "https://app.example/reset-password",
      }),
    ).resolves.toEqual({
      kind: "logged_out",
      status: "unauthenticated",
      message: "If an account exists, reset instructions have been sent.",
    });

    expect(resetRequest).toEqual({
      email: "tester@example.com",
      redirectTo: "https://app.example/reset-password",
    });
    expect(pageSource).toContain(
      "If an account exists, reset instructions have been sent.",
    );
    expect(pageSource).toContain("/reset-password");
    expect(pageSource).not.toContain("account exists.");
    expect(loginSource).toContain("Forgot password?");
    expect(loginSource).toContain("/forgot-password");
  });
});
