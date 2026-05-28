import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createAuthRuntimeService } from "../../src/services/auth/authRuntimeService";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("phase27 logout session ux", () => {
  test("logout remains wrapper-mediated and clears backend-derived identity safely", async () => {
    const dashboardSource = readSource("src/pages/DashboardPage.tsx");
    const authStoreSource = readSource("src/store/authStore.ts");
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
          updatePassword: async () => ({ ok: true, data: undefined }),
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

    await expect(service.logoutFromAuthRuntime()).resolves.toEqual({
      kind: "logged_out",
      status: "unauthenticated",
      message: "Backend session cleared.",
    });
    expect(signOutCalls).toBe(1);
    expect(backendLogoutCalls).toBe(1);
    expect(dashboardSource).toContain("Log out");
    expect(dashboardSource).toContain("Signing out...");
    expect(authStoreSource).toContain("identity: undefined");
  });
});
