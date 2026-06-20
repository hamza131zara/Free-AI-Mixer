import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createAuthRuntimeService } from "../../src/services/auth/authRuntimeService";
import {
  initializeSupabaseAuthSessionBridge,
  type SupabaseAuthSessionBridgeStatus,
} from "../../src/services/auth/supabaseAuthSessionBridge";
import type {
  SupabaseAuthClientHandle,
  SupabaseAuthClientResult,
  SupabaseAuthSessionSnapshot,
} from "../../src/services/auth/supabaseAuthClient";
import type { AuthRecoveryStatus, AuthSessionResult } from "../../src/types/auth";

const projectFile = (relativePath: string): string =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

const neutralResetCopy = "If an account exists, reset instructions have been sent.";

const createSession = (
  accessToken?: string,
): SupabaseAuthSessionSnapshot => ({
  accessToken,
  hasSession: Boolean(accessToken),
});

const createReadyAuthClient = (overrides: Partial<SupabaseAuthClientHandle> = {}): SupabaseAuthClientResult => {
  const handle: SupabaseAuthClientHandle = {
    getAccessToken: async () => ({ data: undefined, ok: true }),
    getSession: async () => ({ data: createSession(), ok: true }),
    onAuthStateChange: () => ({ unsubscribe() {} }),
    requestPasswordReset: async () => ({ data: undefined, ok: true }),
    signInWithPassword: async () => ({ data: createSession("login-token"), ok: true }),
    signOut: async () => ({ data: undefined, ok: true }),
    signUp: async () => ({ data: createSession(), ok: true }),
    updatePassword: async () => ({ data: undefined, ok: true }),
    ...overrides,
  };

  return {
    auth: handle,
    kind: "supabase_auth_client_ready",
  };
};

const installWindow = (location: Pick<Location, "hash" | "pathname" | "search">) => {
  const originalWindow = globalThis.window;
  const replaceStateCalls: string[] = [];
  const mockedLocation = {
    hash: location.hash,
    pathname: location.pathname,
    search: location.search,
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      history: {
        replaceState: (_state: unknown, _title: string, url: string) => {
          const nextUrl = String(url);
          const parsed = new URL(nextUrl, "https://free-ai-mixer.test");
          replaceStateCalls.push(nextUrl);
          mockedLocation.pathname = parsed.pathname;
          mockedLocation.search = parsed.search;
          mockedLocation.hash = parsed.hash;
        },
        state: {},
      },
      location: mockedLocation,
    },
  });

  return {
    replaceStateCalls,
    restore() {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    },
  };
};

const cleanupBridge = (bridge: SupabaseAuthSessionBridgeStatus): void => {
  bridge.unsubscribe();
};

test.describe("hosted private beta H6-C auth lifecycle hardening", () => {
  test("ordinary logout signs out provider first then clears backend session", async () => {
    let signOutCalls = 0;
    let backendLogoutCalls = 0;
    const service = createAuthRuntimeService({
      bootstrapAccount: async () => undefined,
      getAuthSession: async () => ({
        kind: "unauthenticated",
        message: "Signed out.",
        reason: "missing_credentials",
        status: "unauthenticated",
      }),
      getSupabaseAuthClient: () =>
        createReadyAuthClient({
          signOut: async () => {
            signOutCalls += 1;
            return { data: undefined, ok: true };
          },
        }),
      logoutFromBackendAuth: async () => {
        backendLogoutCalls += 1;
        return {
          kind: "logged_out",
          message: "Backend session cleared.",
          status: "unauthenticated",
        };
      },
    });

    await expect(service.logoutFromAuthRuntime()).resolves.toEqual({
      kind: "logged_out",
      message: "Backend session cleared.",
      status: "unauthenticated",
    });
    expect(signOutCalls).toBe(1);
    expect(backendLogoutCalls).toBe(1);
    expect(projectFile("src/store/authStore.ts")).toContain("identity: undefined");
  });

  test("ordinary logout provider failure does not fake completed sign-out", async () => {
    let backendLogoutCalls = 0;
    const service = createAuthRuntimeService({
      bootstrapAccount: async () => undefined,
      getAuthSession: async () => ({
        kind: "authenticated",
        identity: { userId: "backend-user" },
        message: "Backend session verified.",
        status: "authenticated",
      }),
      getSupabaseAuthClient: () =>
        createReadyAuthClient({
          signOut: async () => ({
            errorMessage: "raw provider stack should not leak",
            ok: false,
          }),
        }),
      logoutFromBackendAuth: async () => {
        backendLogoutCalls += 1;
        return {
          kind: "logged_out",
          message: "Backend session cleared.",
          status: "unauthenticated",
        };
      },
    });

    await expect(service.logoutFromAuthRuntime()).resolves.toEqual({
      code: "auth_service_unreachable",
      kind: "unavailable",
      message:
        "Logout could not be completed because the auth provider session may still be active.",
      status: "unavailable",
    });
    expect(backendLogoutCalls).toBe(0);
    expect(projectFile("src/store/authStore.ts")).toContain("identity: state.identity");
  });

  test("signed-out refresh bridge does not invent authenticated state", async () => {
    let refreshCalls = 0;
    const bridge = await initializeSupabaseAuthSessionBridge({
      getAuthClient: () => createReadyAuthClient(),
      refreshBackendSession: async () => {
        refreshCalls += 1;
      },
    });

    cleanupBridge(bridge);
    expect(refreshCalls).toBe(0);
  });

  test("forgot password success and account-not-found-like responses use neutral copy", async () => {
    const successService = createAuthRuntimeService({
      bootstrapAccount: async () => undefined,
      getAuthSession: async () => ({
        kind: "unauthenticated",
        message: "Signed out.",
        reason: "missing_credentials",
        status: "unauthenticated",
      }),
      getSupabaseAuthClient: () => createReadyAuthClient(),
      logoutFromBackendAuth: async () => ({
        kind: "logged_out",
        message: "Signed out.",
        status: "unauthenticated",
      }),
    });
    const notFoundService = createAuthRuntimeService({
      bootstrapAccount: async () => undefined,
      getAuthSession: async () => ({
        kind: "unauthenticated",
        message: "Signed out.",
        reason: "missing_credentials",
        status: "unauthenticated",
      }),
      getSupabaseAuthClient: () =>
        createReadyAuthClient({
          requestPasswordReset: async () => ({
            errorMessage: "User not found",
            ok: false,
          }),
        }),
      logoutFromBackendAuth: async () => ({
        kind: "logged_out",
        message: "Signed out.",
        status: "unauthenticated",
      }),
    });

    await expect(
      successService.requestPasswordResetWithSupabaseRuntime({
        email: "tester@example.test",
        redirectTo: "https://free-ai-mixer.vercel.app/reset-password",
      }),
    ).resolves.toEqual({
      kind: "logged_out",
      message: neutralResetCopy,
      status: "unauthenticated",
    });
    await expect(
      notFoundService.requestPasswordResetWithSupabaseRuntime({
        email: "missing@example.test",
        redirectTo: "https://free-ai-mixer.vercel.app/reset-password",
      }),
    ).resolves.toEqual({
      kind: "logged_out",
      message: neutralResetCopy,
      status: "unauthenticated",
    });
  });

  test("forgot password operational failure exposes only generic unavailable copy", async () => {
    const service = createAuthRuntimeService({
      bootstrapAccount: async () => undefined,
      getAuthSession: async () => ({
        kind: "unauthenticated",
        message: "Signed out.",
        reason: "missing_credentials",
        status: "unauthenticated",
      }),
      getSupabaseAuthClient: () =>
        createReadyAuthClient({
          requestPasswordReset: async () => ({
            errorMessage:
              "SMTP provider said token reset URL for real-user@example.test failed with stack",
            ok: false,
          }),
        }),
      logoutFromBackendAuth: async () => ({
        kind: "logged_out",
        message: "Signed out.",
        status: "unauthenticated",
      }),
    });

    const result = await service.requestPasswordResetWithSupabaseRuntime({
      email: "real-user@example.test",
      redirectTo: "https://free-ai-mixer.vercel.app/reset-password",
    });

    expect(result).toEqual({
      code: "auth_service_unreachable",
      kind: "unavailable",
      message: "Authentication service is temporarily unavailable. Please try again later.",
      status: "unavailable",
    });
    expect(JSON.stringify(result)).not.toContain("real-user@example.test");
    expect(JSON.stringify(result)).not.toContain("reset URL");
    expect(JSON.stringify(result)).not.toContain("stack");
  });

  test("recovery callback bypasses backend session bootstrap and cleans URL after processing", async () => {
    const windowHarness = installWindow({
      hash: "#access_token=recovery-token&refresh_token=refresh&type=recovery",
      pathname: "/reset-password",
      search: "",
    });
    const recoveryStates: AuthRecoveryStatus[] = [];
    let refreshCalls = 0;
    let bootstrapCalls = 0;
    let authStateCallback:
      | Parameters<SupabaseAuthClientHandle["onAuthStateChange"]>[0]
      | undefined;

    try {
      const bridge = await initializeSupabaseAuthSessionBridge({
        bootstrapBackendAccount: async () => {
          bootstrapCalls += 1;
        },
        getAuthClient: () =>
          createReadyAuthClient({
            getAccessToken: async () => ({ data: "recovery-token", ok: true }),
            onAuthStateChange: (callback) => {
              authStateCallback = callback;
              return { unsubscribe() {} };
            },
          }),
        setRecoveryState: (state) => {
          recoveryStates.push(state);
        },
        refreshBackendSession: async () => {
          refreshCalls += 1;
        },
      });

      authStateCallback?.("SIGNED_IN", createSession("recovery-token"));
      cleanupBridge(bridge);
    } finally {
      windowHarness.restore();
    }

    expect(recoveryStates).toEqual(["recovery_processing", "recovery_ready"]);
    expect(refreshCalls).toBe(0);
    expect(bootstrapCalls).toBe(0);
    expect(windowHarness.replaceStateCalls).toEqual(["/reset-password"]);
  });

  test("ordinary confirmation callback preserves backend bootstrap behavior", async () => {
    const windowHarness = installWindow({
      hash: "#access_token=signup-token&refresh_token=refresh&type=signup",
      pathname: "/login",
      search: "",
    });
    let refreshCalls = 0;
    let bootstrapCalls = 0;

    try {
      const bridge = await initializeSupabaseAuthSessionBridge({
        bootstrapBackendAccount: async (accessToken) => {
          bootstrapCalls += 1;
          expect(accessToken).toBe("signup-token");
        },
        getAuthClient: () =>
          createReadyAuthClient({
            getAccessToken: async () => ({ data: "signup-token", ok: true }),
          }),
        refreshBackendSession: async (accessToken): Promise<AuthSessionResult> => {
          refreshCalls += 1;
          expect(accessToken).toBe("signup-token");
          return {
            identity: { userId: "backend-user", workspaceAuthority: "verified" },
            kind: "authenticated",
            message: "Backend session verified.",
            status: "authenticated",
          };
        },
      });

      cleanupBridge(bridge);
    } finally {
      windowHarness.restore();
    }

    expect(refreshCalls).toBe(2);
    expect(bootstrapCalls).toBe(1);
    expect(windowHarness.replaceStateCalls).toEqual(["/login"]);
  });

  test("reset page requires recovery readiness confirmation and matching passwords", () => {
    const resetSource = projectFile("src/pages/ResetPasswordPage.tsx");

    expect(resetSource).toContain('recoveryStatus === "recovery_ready"');
    expect(resetSource).toContain("formDisabled = !recoveryReady");
    expect(resetSource).toContain("password !== confirmPassword");
    expect(resetSource).toContain("Request a fresh password reset link");
    expect(resetSource).toContain("updateRecoveryPassword(password)");
    expect(resetSource).not.toContain("updatePasswordWithSupabaseRuntime(password)");
    expect(resetSource).not.toContain("bootstrapAccount");
  });

  test("valid password update calls Supabase update once then signs out recovery session", async () => {
    let updateCalls = 0;
    let signOutCalls = 0;
    let backendLogoutCalls = 0;
    const service = createAuthRuntimeService({
      bootstrapAccount: async () => undefined,
      getAuthSession: async () => ({
        kind: "unauthenticated",
        message: "Signed out.",
        reason: "missing_credentials",
        status: "unauthenticated",
      }),
      getSupabaseAuthClient: () =>
        createReadyAuthClient({
          signOut: async () => {
            signOutCalls += 1;
            return { data: undefined, ok: true };
          },
          updatePassword: async (newPassword) => {
            updateCalls += 1;
            expect(newPassword).toBe("matching-password-123");
            return { data: undefined, ok: true };
          },
        }),
      logoutFromBackendAuth: async () => {
        backendLogoutCalls += 1;
        return {
          kind: "logged_out",
          message: "Backend session cleared.",
          status: "unauthenticated",
        };
      },
    });

    await expect(
      service.updatePasswordWithSupabaseRuntime("matching-password-123"),
    ).resolves.toEqual({
      kind: "logged_out",
      message: "Password updated. Sign in again to continue.",
      recoveryStatus: "recovery_complete",
      status: "unauthenticated",
    });
    expect(updateCalls).toBe(1);
    expect(signOutCalls).toBe(1);
    expect(backendLogoutCalls).toBe(1);
  });

  test("password update and sign-out failures remain truthful and sanitized", async () => {
    const updateFailureService = createAuthRuntimeService({
      bootstrapAccount: async () => undefined,
      getAuthSession: async () => ({
        kind: "unauthenticated",
        message: "Signed out.",
        reason: "missing_credentials",
        status: "unauthenticated",
      }),
      getSupabaseAuthClient: () =>
        createReadyAuthClient({
          updatePassword: async () => ({
            errorMessage: "raw password token failure",
            ok: false,
          }),
        }),
      logoutFromBackendAuth: async () => ({
        kind: "logged_out",
        message: "Signed out.",
        status: "unauthenticated",
      }),
    });
    const signOutFailureService = createAuthRuntimeService({
      bootstrapAccount: async () => undefined,
      getAuthSession: async () => ({
        kind: "unauthenticated",
        message: "Signed out.",
        reason: "missing_credentials",
        status: "unauthenticated",
      }),
      getSupabaseAuthClient: () =>
        createReadyAuthClient({
          signOut: async () => ({
            errorMessage: "raw cleanup token failure",
            ok: false,
          }),
          updatePassword: async () => ({ data: undefined, ok: true }),
        }),
      logoutFromBackendAuth: async () => {
        throw new Error("backend logout should not run after provider sign-out failure");
      },
    });

    await expect(
      updateFailureService.updatePasswordWithSupabaseRuntime("new-password"),
    ).resolves.toEqual({
      code: "auth_service_unreachable",
      kind: "unavailable",
      message:
        "Password update could not be completed safely. Request a fresh reset link if this continues.",
      status: "unavailable",
    });
    await expect(
      signOutFailureService.updatePasswordWithSupabaseRuntime("new-password"),
    ).resolves.toEqual({
      code: "auth_service_unreachable",
      kind: "unavailable",
      message:
        "Password updated, but session cleanup could not be confirmed. Close this browser session and sign in again.",
      status: "unavailable",
    });
  });

  test("passwords and recovery secrets are not sent to Render or stored manually", () => {
    const combinedSource = [
      "src/services/auth/authRuntimeService.ts",
      "src/services/auth/supabaseAuthClient.ts",
      "src/services/auth/supabaseAuthSessionBridge.ts",
      "src/store/authStore.ts",
      "src/pages/ForgotPasswordPage.tsx",
      "src/pages/ResetPasswordPage.tsx",
    ].map(projectFile).join("\n");

    expect(combinedSource).toContain("client.auth.updateUser");
    expect(combinedSource).toContain("resetPasswordForEmail");
    expect(combinedSource).not.toContain("localStorage.setItem");
    expect(combinedSource).not.toContain("sessionStorage.setItem");
    expect(combinedSource).not.toContain("console.log");
    expect(combinedSource).not.toContain("service_role");
    expect(combinedSource).not.toContain("secret_ref");
    expect(combinedSource).not.toContain("encrypted_payload");
    expect(combinedSource).not.toContain("bootstrapAccount(password");
    expect(combinedSource).not.toContain("getAuthSession(password");
  });
});
