import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createAuthenticatedFetch } from "../../src/services/auth/authenticatedFetch";
import { createAuthRuntimeService } from "../../src/services/auth/authRuntimeService";
import {
  hasSupabaseAuthUrlPayload,
  initializeSupabaseAuthSessionBridge,
} from "../../src/services/auth/supabaseAuthSessionBridge";
import type {
  SupabaseAuthClientHandle,
  SupabaseAuthClientResult,
} from "../../src/services/auth/supabaseAuthClient";
import type {
  AuthMutationResult,
  AuthSessionResult,
  VerifiedAccountIdentity,
} from "../../src/types/auth";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const incompleteWorkspaceIdentity: VerifiedAccountIdentity = {
  authProvider: "supabase",
  authSubject: "backend-user-id",
  email: "hosted-auth@example.test",
  userId: "backend-user-id",
  workspaceAuthority: "not_available",
  workspaceAuthorityReason: "no_active_workspace_membership",
};

const verifiedWorkspaceIdentity: VerifiedAccountIdentity = {
  authProvider: "supabase",
  authSubject: "backend-user-id",
  email: "hosted-auth@example.test",
  userId: "backend-user-id",
  workspaceAuthority: "verified",
  workspaceId: "backend-workspace-id",
  workspaceRole: "workspace_owner",
};

const createReadyAuthClient = (
  input: {
    accessToken?: string | null;
    onAuthStateChange?: SupabaseAuthClientHandle["onAuthStateChange"];
  } = {},
): SupabaseAuthClientResult => ({
  auth: {
    getAccessToken: async () => ({
      data:
        input.accessToken === null
          ? undefined
          : input.accessToken ?? "restored-token",
      ok: true,
    }),
    getSession: async () => ({
      data: {
        ...(input.accessToken === null
          ? {}
          : { accessToken: input.accessToken ?? "restored-token" }),
        hasSession: input.accessToken !== null,
      },
      ok: true,
    }),
    onAuthStateChange:
      input.onAuthStateChange ??
      (() => ({
        unsubscribe() {},
      })),
    requestPasswordReset: async () => ({
      data: undefined,
      ok: true,
    }),
    signInWithPassword: async () => ({
      data: {
        accessToken: input.accessToken ?? "restored-token",
        hasSession: true,
      },
      ok: true,
    }),
    signOut: async () => ({
      data: undefined,
      ok: true,
    }),
    signUp: async () => ({
      data: {
        hasSession: false,
      },
      ok: true,
    }),
    updatePassword: async () => ({
      data: undefined,
      ok: true,
    }),
  },
  kind: "supabase_auth_client_ready",
});

test.describe("hosted auth Vercel SPA and Supabase confirmation session", () => {
  test("Vercel proxies backend API prefixes before the Vite SPA fallback", () => {
    const vercelConfig = JSON.parse(readSource("vercel.json")) as {
      rewrites?: Array<{ destination?: string; source?: string }>;
    };
    const renderOrigin = "https://free-ai-mixer.onrender.com";

    expect(vercelConfig.rewrites).toEqual([
      {
        source: "/auth/:path*",
        destination: `${renderOrigin}/auth/:path*`,
      },
      {
        source: "/account/:path*",
        destination: `${renderOrigin}/account/:path*`,
      },
      {
        source: "/provider-settings/:path*",
        destination: `${renderOrigin}/provider-settings/:path*`,
      },
      {
        source: "/generation/:path*",
        destination: `${renderOrigin}/generation/:path*`,
      },
      {
        source: "/credits/:path*",
        destination: `${renderOrigin}/credits/:path*`,
      },
      {
        source: "/billing/:path*",
        destination: `${renderOrigin}/billing/:path*`,
      },
      {
        source: "/project-library/:path*",
        destination: `${renderOrigin}/project-library/:path*`,
      },
      {
        source: "/exports/:path*",
        destination: `${renderOrigin}/exports/:path*`,
      },
      {
        source: "/admin/:path*",
        destination: `${renderOrigin}/admin/:path*`,
      },
      {
        source: "/ai-tools/:path*",
        destination: `${renderOrigin}/ai-tools/:path*`,
      },
      {
        source: "/ai-news/:path*",
        destination: `${renderOrigin}/ai-news/:path*`,
      },
      {
        source: "/cards/:path*",
        destination: `${renderOrigin}/cards/:path*`,
      },
      {
        source: "/templates/:path*",
        destination: `${renderOrigin}/templates/:path*`,
      },
      {
        source: "/(.*)",
        destination: "/index.html",
      },
    ]);

    const rewrites = vercelConfig.rewrites ?? [];
    const spaFallbackIndex = rewrites.findIndex(
      (rewrite) =>
        rewrite.source === "/(.*)" && rewrite.destination === "/index.html",
    );
    const authProxyIndex = rewrites.findIndex(
      (rewrite) =>
        rewrite.source === "/auth/:path*" &&
        rewrite.destination === `${renderOrigin}/auth/:path*`,
    );
    const accountProxyIndex = rewrites.findIndex(
      (rewrite) =>
        rewrite.source === "/account/:path*" &&
        rewrite.destination === `${renderOrigin}/account/:path*`,
    );

    expect(authProxyIndex).toBeGreaterThanOrEqual(0);
    expect(accountProxyIndex).toBeGreaterThanOrEqual(0);
    expect(spaFallbackIndex).toBeGreaterThan(authProxyIndex);
    expect(spaFallbackIndex).toBeGreaterThan(accountProxyIndex);
    expect(rewrites).not.toContainEqual({
      source: "/:path*",
      destination: `${renderOrigin}/:path*`,
    });
    expect(rewrites).not.toContainEqual({
      source: "/(.*)",
      destination: `${renderOrigin}/$1`,
    });

    const vercelSource = readSource("vercel.json");
    expect(vercelSource).not.toContain("Bearer ");
    expect(vercelSource).not.toContain("access_token");
    expect(vercelSource).not.toContain("refresh_token");
    expect(vercelSource).not.toContain("service_role");
    expect(vercelSource).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(vercelSource).not.toContain("sk-");
  });

  test("React Router auth pages remain handled by the SPA fallback", () => {
    const navigationSource = readSource("src/services/navigationService.ts");
    const vercelConfig = JSON.parse(readSource("vercel.json")) as {
      rewrites?: Array<{ destination?: string; source?: string }>;
    };

    expect(navigationSource).toContain('path: "/login"');
    expect(navigationSource).toContain('path: "/signup"');
    expect(navigationSource).toContain('path: "/reset-password"');
    expect(vercelConfig.rewrites?.at(-1)).toEqual({
      source: "/(.*)",
      destination: "/index.html",
    });
  });

  test("protected refresh treats unresolved auth as session hydration, not signed out", () => {
    const navigationSource = readSource("src/components/AppNavigation.tsx");
    const protectedRouteSource = readSource("src/components/ProtectedRouteShell.tsx");
    const storeSource = readSource("src/store/authStore.ts");

    expect(storeSource).toContain('status: "unknown"');
    expect(storeSource).toContain("Checking backend session status.");

    expect(navigationSource).toContain(
      'const isCheckingSession = authStatus === "unknown";',
    );
    expect(navigationSource).toContain('data-testid="nav-auth-checking"');
    expect(navigationSource).toContain('data-testid="mobile-nav-auth-checking"');
    expect(navigationSource).toContain("Checking session...");
    expect(navigationSource).toContain('authStatus === "authenticated"');
    expect(navigationSource).toContain('authStatus === "unauthenticated"');
    expect(navigationSource).toContain(
      'const isAuthUnavailable = authStatus === "unavailable";',
    );

    const checkingBranchIndex = navigationSource.indexOf(
      ') : isCheckingSession ? (',
    );
    const authLinksIndex = navigationSource.indexOf(
      "authNavigationItems.map",
      checkingBranchIndex,
    );
    expect(checkingBranchIndex).toBeGreaterThanOrEqual(0);
    expect(authLinksIndex).toBeGreaterThan(checkingBranchIndex);

    expect(protectedRouteSource).toContain('authStatus === "unknown"');
    expect(protectedRouteSource).toContain("Restoring your secure session");
    expect(protectedRouteSource).toContain("Checking session with the backend auth boundary.");
    expect(protectedRouteSource).toContain('authStatus === "unauthenticated"');
    expect(protectedRouteSource).toContain("Sign in required");
    expect(protectedRouteSource).toContain("Go to login");
  });

  test("signup confirmation uses the existing same-origin login route", () => {
    const runtimeSource = readSource("src/services/auth/authRuntimeService.ts");
    const navigationSource = readSource("src/services/navigationService.ts");

    expect(navigationSource).toContain('path: "/login"');
    expect(runtimeSource).toContain("getSignupEmailRedirectTo");
    expect(runtimeSource).toContain("window.location.origin");
    expect(runtimeSource).toContain('}/login');
    expect(runtimeSource).toContain(
      "emailRedirectTo: credentials.emailRedirectTo ?? getSignupEmailRedirectTo()",
    );
  });

  test("confirmation session handling matches the existing implicit browser session flow", () => {
    const clientSource = readSource("src/services/auth/supabaseAuthClient.ts");
    const bridgeSource = readSource("src/services/auth/supabaseAuthSessionBridge.ts");
    const storeSource = readSource("src/store/authStore.ts");

    expect(clientSource).toContain("createClient(projectUrl, anonKey)");
    expect(clientSource).toContain("client.auth.getSession()");
    expect(clientSource).toContain("client.auth.onAuthStateChange");
    expect(clientSource).not.toContain("exchangeCodeForSession");
    expect(clientSource).not.toContain("flowType");
    expect(clientSource).not.toContain("detectSessionInUrl: false");

    expect(bridgeSource).toContain("authClient.auth.getAccessToken()");
    expect(bridgeSource).toContain("cleanupSupabaseAuthUrl()");
    expect(storeSource).toContain("initializeSupabaseAuthSessionBridge");
    expect(storeSource).toContain("refreshSession(accessToken)");

    expect(
      hasSupabaseAuthUrlPayload({
        hash: "#access_token=confirmed-token&refresh_token=refresh&type=signup",
        search: "",
      } as Location),
    ).toBe(true);
    expect(
      hasSupabaseAuthUrlPayload({
        hash: "",
        search: "?code=pkce-style-code&type=signup",
      } as Location),
    ).toBe(true);
    expect(
      hasSupabaseAuthUrlPayload({
        hash: "",
        search: "?utm_source=email",
      } as Location),
    ).toBe(false);
  });

  test("authenticated backend requests attach bearer tokens through the approved boundary", async () => {
    const calls: Array<{ authorization: string | null; input: string }> = [];
    const fetchWithBearer = createAuthenticatedFetch({
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        calls.push({
          authorization: headers.get("Authorization"),
          input: String(input),
        });
        return new Response("{}", { status: 200 });
      },
      getSupabaseAuthClient: () =>
        ({
          auth: {
            getAccessToken: async () => ({
              data: "hosted-confirmation-token",
              ok: true,
            }),
          },
          kind: "supabase_auth_client_ready",
        }) as any,
    });

    await fetchWithBearer("/generation/jobs", { method: "POST" });
    await fetchWithBearer("/unprotected-route", { method: "GET" });

    expect(calls).toEqual([
      {
        authorization: "Bearer hosted-confirmation-token",
        input: "/generation/jobs",
      },
      {
        authorization: null,
        input: "/unprotected-route",
      },
    ]);
  });

  test("frontend auth source avoids backend-only secrets and fake session creation", () => {
    const frontendAuthSource = [
      "src/services/auth/authRuntimeService.ts",
      "src/services/auth/supabaseAuthClient.ts",
      "src/services/auth/supabaseAuthSessionBridge.ts",
      "src/services/auth/authenticatedFetch.ts",
      "src/store/authStore.ts",
      "src/pages/LoginPage.tsx",
      "src/pages/SignupPage.tsx",
      "src/pages/ResetPasswordPage.tsx",
    ]
      .map(readSource)
      .join("\n");

    expect(frontendAuthSource).not.toContain("service_role");
    expect(frontendAuthSource).not.toContain("service-role");
    expect(frontendAuthSource).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(frontendAuthSource).not.toContain("encrypted_payload");
    expect(frontendAuthSource).not.toContain("secret_ref");
    expect(frontendAuthSource).not.toContain("provider_api_key");
    expect(frontendAuthSource).not.toContain("localStorage.setItem");
    expect(frontendAuthSource).not.toContain("sessionStorage.setItem");
    expect(frontendAuthSource).not.toContain("workspaceId: \"fake");
    expect(frontendAuthSource).not.toContain("workspaceId: 'fake");
    expect(frontendAuthSource).not.toContain("mockSession");
    expect(frontendAuthSource).not.toContain("fakeSession");

    const runtimeSource = readSource("src/services/auth/authRuntimeService.ts");

    expect(runtimeSource).toContain(
      'if (result.kind === "account_bootstrap_complete")',
    );
    expect(runtimeSource).toContain("identity: result.identity");
    expect(runtimeSource).toContain(
      "const bootstrapResult = await dependencies.bootstrapAccount",
    );
    expect(runtimeSource).not.toMatch(
      /identity:\s*\{\s*(userId|workspaceId|email)\s*:/,
    );
  });

  test("auth runtime only returns authenticated state from backend-derived identity", async () => {
    const backendIdentity: VerifiedAccountIdentity = {
      authProvider: "supabase",
      email: "hosted-auth@example.test",
      userId: "backend-user-id",
      workspaceAuthority: "verified",
      workspaceId: "backend-workspace-id",
      workspaceRole: "owner",
    };

    const createRuntime = (
      bootstrapAccount: () => Promise<any>,
      getAuthSession: () => Promise<AuthSessionResult | AuthMutationResult>,
    ) =>
      createAuthRuntimeService({
        bootstrapAccount,
        getAuthSession,
        getSupabaseAuthClient: () =>
          ({
            auth: {
              signInWithPassword: async () => ({
                data: {
                  accessToken: "backend-issued-token",
                  hasSession: true,
                },
                ok: true,
              }),
            },
            kind: "supabase_auth_client_ready",
          }) as any,
        logoutFromBackendAuth: async () => ({
          kind: "logged_out",
          message: "Logged out.",
          status: "unauthenticated",
        }),
      });

    const unavailableRuntime = createRuntime(
      async () => undefined,
      async () => ({
        kind: "unauthenticated",
        message: "Backend session unavailable.",
        reason: "missing_credentials",
        status: "unauthenticated",
      }),
    );

    await expect(
      unavailableRuntime.loginWithSupabaseRuntime({
        email: "hosted-auth@example.test",
        password: "password",
      }),
    ).resolves.toMatchObject({
      code: "account_bootstrap_unavailable",
      kind: "unavailable",
      status: "unavailable",
    });

    let sessionLookupCount = 0;
    const authenticatedRuntime = createRuntime(
      async () => ({
        bootstrap: {
          appUserCreated: true,
          membershipCreated: true,
          workspaceCreated: true,
        },
        identity: backendIdentity,
        kind: "account_bootstrap_complete",
        status: "authenticated",
      }),
      async () => {
        sessionLookupCount += 1;

        if (sessionLookupCount === 1) {
          return {
            kind: "unauthenticated",
            message: "Backend session not ready before bootstrap.",
            reason: "missing_credentials",
            status: "unauthenticated",
          };
        }

        return {
          identity: backendIdentity,
          kind: "authenticated",
          message: "Backend session verified.",
          status: "authenticated",
        };
      },
    );

    await expect(
      authenticatedRuntime.loginWithSupabaseRuntime({
        email: "hosted-auth@example.test",
        password: "password",
      }),
    ).resolves.toEqual({
      identity: backendIdentity,
      kind: "authenticated",
      message: "Backend session verified.",
      status: "authenticated",
    });
  });

  test("normal password login repairs authenticated sessions with incomplete workspace authority", async () => {
    let bootstrapCalls = 0;
    let sessionCalls = 0;
    const runtime = createAuthRuntimeService({
      bootstrapAccount: async (accessToken) => {
        bootstrapCalls += 1;
        expect(accessToken).toBe("login-token");

        return {
          bootstrap: {
            appUserCreated: false,
            membershipCreated: true,
            workspaceCreated: true,
          },
          identity: verifiedWorkspaceIdentity,
          kind: "account_bootstrap_complete",
          status: "authenticated",
        };
      },
      getAuthSession: async (accessToken) => {
        sessionCalls += 1;
        expect(accessToken).toBe("login-token");

        return sessionCalls === 1
          ? {
              identity: incompleteWorkspaceIdentity,
              kind: "authenticated",
              message: "Backend identity verified. Workspace authority is not available yet.",
              status: "authenticated",
            }
          : {
              identity: verifiedWorkspaceIdentity,
              kind: "authenticated",
              message: "Backend session verified.",
              status: "authenticated",
            };
      },
      getSupabaseAuthClient: () =>
        createReadyAuthClient({ accessToken: "login-token" }),
      logoutFromBackendAuth: async () => ({
        kind: "logged_out",
        message: "Logged out.",
        status: "unauthenticated",
      }),
    });

    await expect(
      runtime.loginWithSupabaseRuntime({
        email: "hosted-auth@example.test",
        password: "password",
      }),
    ).resolves.toEqual({
      identity: verifiedWorkspaceIdentity,
      kind: "authenticated",
      message: "Backend session verified.",
      status: "authenticated",
    });
    expect(bootstrapCalls).toBe(1);
    expect(sessionCalls).toBe(2);
  });

  test("normal password login skips bootstrap when backend workspace authority is already verified", async () => {
    let bootstrapCalls = 0;
    let sessionCalls = 0;
    const runtime = createAuthRuntimeService({
      bootstrapAccount: async () => {
        bootstrapCalls += 1;
        return undefined;
      },
      getAuthSession: async () => {
        sessionCalls += 1;
        return {
          identity: verifiedWorkspaceIdentity,
          kind: "authenticated",
          message: "Backend session verified.",
          status: "authenticated",
        };
      },
      getSupabaseAuthClient: () =>
        createReadyAuthClient({ accessToken: "login-token" }),
      logoutFromBackendAuth: async () => ({
        kind: "logged_out",
        message: "Logged out.",
        status: "unauthenticated",
      }),
    });

    await expect(
      runtime.loginWithSupabaseRuntime({
        email: "hosted-auth@example.test",
        password: "password",
      }),
    ).resolves.toEqual({
      identity: verifiedWorkspaceIdentity,
      kind: "authenticated",
      message: "Backend session verified.",
      status: "authenticated",
    });
    expect(bootstrapCalls).toBe(0);
    expect(sessionCalls).toBe(1);
  });

  test("workspace repair bootstrap failure preserves the truthful incomplete session", async () => {
    let bootstrapCalls = 0;
    let sessionCalls = 0;
    const runtime = createAuthRuntimeService({
      bootstrapAccount: async () => {
        bootstrapCalls += 1;
        return {
          kind: "bootstrap_unavailable",
          message: "Account bootstrap is unavailable.",
          status: "bootstrap_unavailable",
        };
      },
      getAuthSession: async () => {
        sessionCalls += 1;
        return {
          identity: incompleteWorkspaceIdentity,
          kind: "authenticated",
          message: "Backend identity verified. Workspace authority is not available yet.",
          status: "authenticated",
        };
      },
      getSupabaseAuthClient: () =>
        createReadyAuthClient({ accessToken: "login-token" }),
      logoutFromBackendAuth: async () => ({
        kind: "logged_out",
        message: "Logged out.",
        status: "unauthenticated",
      }),
    });

    await expect(
      runtime.loginWithSupabaseRuntime({
        email: "hosted-auth@example.test",
        password: "password",
      }),
    ).resolves.toEqual({
      identity: incompleteWorkspaceIdentity,
      kind: "authenticated",
      message: "Backend identity verified. Workspace authority is not available yet.",
      status: "authenticated",
    });
    expect(bootstrapCalls).toBe(1);
    expect(sessionCalls).toBe(1);
  });

  test("restored browser session repairs incomplete workspace authority without callback URL parameters", async () => {
    let bootstrapCalls = 0;
    const refreshedIdentities: VerifiedAccountIdentity[] = [
      incompleteWorkspaceIdentity,
      verifiedWorkspaceIdentity,
    ];
    const refreshResults: AuthSessionResult[] = [];
    const bridge = await initializeSupabaseAuthSessionBridge({
      bootstrapBackendAccount: async (accessToken) => {
        bootstrapCalls += 1;
        expect(accessToken).toBe("restored-token");
      },
      getAuthClient: () => createReadyAuthClient({ accessToken: "restored-token" }),
      refreshBackendSession: async (accessToken) => {
        expect(accessToken).toBe("restored-token");
        const result: AuthSessionResult = {
          identity: refreshedIdentities.shift() ?? verifiedWorkspaceIdentity,
          kind: "authenticated",
          message: "Backend session checked.",
          status: "authenticated",
        };
        refreshResults.push(result);
        return result;
      },
    });

    bridge.unsubscribe();
    expect(bootstrapCalls).toBe(1);
    expect(refreshResults).toHaveLength(2);
    expect(refreshResults[0].identity.workspaceAuthority).toBe("not_available");
    expect(refreshResults[1].identity.workspaceAuthority).toBe("verified");
  });

  test("auth callback bootstrap behavior remains supported", async () => {
    const originalWindow = globalThis.window;
    const replaceStateCalls: string[] = [];
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        history: {
          replaceState: (_state: unknown, _title: string, url: string) => {
            replaceStateCalls.push(url);
          },
        },
        location: {
          hash: "#access_token=callback-token&refresh_token=refresh&type=signup",
          pathname: "/login",
          search: "",
        },
      },
    });

    let bootstrapCalls = 0;
    const refreshResults: AuthSessionResult[] = [];
    const bridge = await initializeSupabaseAuthSessionBridge({
      bootstrapBackendAccount: async (accessToken) => {
        bootstrapCalls += 1;
        expect(accessToken).toBe("callback-token");
      },
      getAuthClient: () => createReadyAuthClient({ accessToken: "callback-token" }),
      refreshBackendSession: async () => {
        const result: AuthSessionResult = {
          identity: verifiedWorkspaceIdentity,
          kind: "authenticated",
          message: "Backend session verified.",
          status: "authenticated",
        };
        refreshResults.push(result);
        return result;
      },
    });

    bridge.unsubscribe();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });

    expect(bootstrapCalls).toBe(1);
    expect(refreshResults).toHaveLength(2);
    expect(replaceStateCalls).toEqual(["/login"]);
  });

  test("auth-state events share one concurrent workspace repair bootstrap", async () => {
    let authStateCallback:
      | Parameters<SupabaseAuthClientHandle["onAuthStateChange"]>[0]
      | undefined;
    let releaseBootstrap: (() => void) | undefined;
    let bootstrapCalls = 0;
    let refreshCalls = 0;
    let markBootstrapStarted: (() => void) | undefined;
    let markRefreshComplete: (() => void) | undefined;
    const bootstrapStarted = new Promise<void>((resolve) => {
      markBootstrapStarted = resolve;
    });
    const allRefreshes = new Promise<void>((resolve) => {
      markRefreshComplete = () => {
        if (refreshCalls >= 4) {
          resolve();
        }
      };
    });
    const bridge = await initializeSupabaseAuthSessionBridge({
      bootstrapBackendAccount: async () => {
        bootstrapCalls += 1;
        markBootstrapStarted?.();
        await new Promise<void>((resolve) => {
          releaseBootstrap = resolve;
        });
      },
      getAuthClient: () =>
        createReadyAuthClient({
          accessToken: null,
          onAuthStateChange: (callback) => {
            authStateCallback = callback;
            return {
              unsubscribe() {},
            };
          },
        }),
      refreshBackendSession: async () => {
        refreshCalls += 1;
        const result: AuthSessionResult = {
          identity:
            refreshCalls <= 2
              ? incompleteWorkspaceIdentity
              : verifiedWorkspaceIdentity,
          kind: "authenticated",
          message: "Backend session checked.",
          status: "authenticated",
        };
        markRefreshComplete?.();
        return result;
      },
    });

    authStateCallback?.("SIGNED_IN", {
      accessToken: "event-token",
      hasSession: true,
    });
    authStateCallback?.("TOKEN_REFRESHED", {
      accessToken: "event-token",
      hasSession: true,
    });

    await bootstrapStarted;
    expect(bootstrapCalls).toBe(1);
    releaseBootstrap?.();
    await allRefreshes;
    bridge.unsubscribe();

    expect(bootstrapCalls).toBe(1);
    expect(refreshCalls).toBe(4);
  });
});
