import { expect, test } from "@playwright/test";
import { createAuthRuntimeService } from "../../src/services/auth/authRuntimeService";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("phase24 signup verification or deferred", () => {
  test("signup stays email-verification-first and does not claim app readiness", async () => {
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
            data: {
              hasSession: false,
            },
          }),
          onAuthStateChange: () => ({
            unsubscribe() {},
          }),
          signInWithPassword: async () => ({
            ok: true,
            data: {
              hasSession: true,
            },
          }),
          signOut: async () => ({ ok: true, data: undefined }),
          signUp: async () => ({
            ok: true,
            data: {
              hasSession: false,
            },
          }),
        },
      }),
      logoutFromBackendAuth: async () => ({
        kind: "logged_out",
        status: "unauthenticated",
        message: "Session cleared.",
      }),
    });

    await expect(
      service.signUpWithSupabaseRuntime({
        email: "new@example.com",
        password: "password",
      }),
    ).resolves.toEqual({
      kind: "unauthenticated",
      status: "unauthenticated",
      reason: "email_verification_required",
      message:
        "Check your email to verify your account before Free AI Mixer account setup can continue.",
    });
  });

  test("signup page copy remains verification-first and does not invent account-ready state", () => {
    const signupPageSource = readSource("src/pages/SignupPage.tsx");

    expect(signupPageSource).toContain("email-verification-first");
    expect(signupPageSource).toContain("does not claim Free AI Mixer account setup is complete");
    expect(signupPageSource).not.toContain("workspace is ready");
    expect(signupPageSource).not.toContain("authenticated immediately");
  });
});
