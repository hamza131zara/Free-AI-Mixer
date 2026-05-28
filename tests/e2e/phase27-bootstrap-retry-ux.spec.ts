import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createAuthRuntimeService } from "../../src/services/auth/authRuntimeService";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("phase27 bootstrap retry ux", () => {
  test("retry setup calls account bootstrap then refreshes backend session", async () => {
    const dashboardSource = readSource("src/pages/DashboardPage.tsx");
    let bootstrapCalls = 0;
    let sessionCalls = 0;

    const service = createAuthRuntimeService({
      bootstrapAccount: async (accessToken) => {
        bootstrapCalls += 1;
        expect(accessToken).toBe("retry-token");

        return {
          kind: "account_bootstrap_complete",
          status: "authenticated",
          message: "Free AI Mixer account setup is complete.",
          identity: {
            userId: "user-1",
            workspaceId: "workspace-1",
            workspaceAuthority: "verified",
          },
          bootstrap: {
            appUserCreated: false,
            workspaceCreated: false,
            membershipCreated: false,
          },
        };
      },
      getAuthSession: async (accessToken) => {
        sessionCalls += 1;
        expect(accessToken).toBe("retry-token");

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
          getAccessToken: async () => ({ ok: true, data: "retry-token" }),
          getSession: async () => ({
            ok: true,
            data: { hasSession: true },
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
          requestPasswordReset: async () => ({ ok: true, data: undefined }),
          updatePassword: async () => ({ ok: true, data: undefined }),
        },
      }),
      logoutFromBackendAuth: async () => ({
        kind: "logged_out",
        status: "unauthenticated",
        message: "Session cleared.",
      }),
    });

    await expect(service.retryAccountBootstrapWithSupabaseRuntime()).resolves.toEqual({
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
    expect(bootstrapCalls).toBe(1);
    expect(sessionCalls).toBe(1);
    expect(dashboardSource).toContain("Retry account setup");
    expect(dashboardSource).toContain("Workspace selection is not available in this beta yet");
  });

  test("retry setup does not fake authenticated state when no token is available", async () => {
    const service = createAuthRuntimeService({
      bootstrapAccount: async () => undefined,
      getAuthSession: async () => ({
        kind: "authenticated",
        status: "authenticated",
        identity: {
          userId: "should-not-appear",
        },
        message: "Should not be used.",
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
          requestPasswordReset: async () => ({ ok: true, data: undefined }),
          updatePassword: async () => ({ ok: true, data: undefined }),
        },
      }),
      logoutFromBackendAuth: async () => ({
        kind: "logged_out",
        status: "unauthenticated",
        message: "Session cleared.",
      }),
    });

    await expect(service.retryAccountBootstrapWithSupabaseRuntime()).resolves.toEqual({
      kind: "unauthenticated",
      status: "unauthenticated",
      reason: "missing_credentials",
      message: "Sign in is required before account setup can be retried.",
    });
  });
});
