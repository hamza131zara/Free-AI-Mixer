import { expect, test } from "@playwright/test";
import { createAuthRuntimeService } from "../../src/services/auth/authRuntimeService";

test.describe("phase24 login runtime boundary", () => {
  test("login fails closed when the frontend auth wrapper is not configured", async () => {
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
      service.loginWithSupabaseRuntime({
        email: "user@example.com",
        password: "password",
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      status: "unavailable",
      code: "supabase_auth_not_configured",
      message: "Supabase Auth is not configured for this frontend yet.",
    });
  });

  test("login signs in with the auth provider then bootstraps and refreshes backend session", async () => {
    let sessionRefreshCalls = 0;
    const service = createAuthRuntimeService({
      bootstrapAccount: async () => ({
        kind: "account_bootstrap_complete",
        status: "authenticated",
        message: "Free AI Mixer account setup is complete.",
        identity: {
          userId: "user-1",
          workspaceId: "workspace-1",
          workspaceAuthority: "verified",
        },
        bootstrap: {
          appUserCreated: true,
          workspaceCreated: true,
          membershipCreated: true,
        },
      }),
      getAuthSession: async () => {
        sessionRefreshCalls += 1;

        if (sessionRefreshCalls === 1) {
          return {
            kind: "unauthenticated",
            status: "unauthenticated",
            reason: "invalid_credentials",
            message:
              "Sign in is required before protected account routes can show verified data.",
          };
        }

        return {
          kind: "authenticated",
          status: "authenticated",
          identity: {
            userId: "user-1",
            workspaceId: "workspace-1",
            workspaceAuthority: "verified",
            authProvider: "supabase",
            authSubject: "user-1",
          },
          message: "Backend session verified.",
        };
      },
      getSupabaseAuthClient: () => ({
        kind: "supabase_auth_client_ready",
        auth: {
          getAccessToken: async () => ({
            ok: true,
            data: "token-1",
          }),
          getSession: async () => ({
            ok: true,
            data: {
              hasSession: true,
            },
          }),
          onAuthStateChange: () => ({
            unsubscribe() {},
          }),
          signInWithPassword: async () => ({
            ok: true,
            data: {
              accessToken: "token-1",
              hasSession: true,
              userId: "user-1",
            },
          }),
          signOut: async () => ({
            ok: true,
            data: undefined,
          }),
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
      service.loginWithSupabaseRuntime({
        email: "user@example.com",
        password: "password",
      }),
    ).resolves.toEqual({
      kind: "authenticated",
      status: "authenticated",
      identity: {
        userId: "user-1",
        workspaceId: "workspace-1",
        workspaceAuthority: "verified",
        authProvider: "supabase",
        authSubject: "user-1",
      },
      message: "Backend session verified.",
    });
    expect(sessionRefreshCalls).toBe(2);
  });
});
