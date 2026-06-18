import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createAuthenticatedFetch } from "../../src/services/auth/authenticatedFetch";
import { createAuthRuntimeService } from "../../src/services/auth/authRuntimeService";
import { hasSupabaseAuthUrlPayload } from "../../src/services/auth/supabaseAuthSessionBridge";
import type {
  AuthMutationResult,
  AuthSessionResult,
  VerifiedAccountIdentity,
} from "../../src/types/auth";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

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
});
