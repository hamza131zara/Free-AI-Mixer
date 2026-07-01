import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { BackendAccountBootstrapResponse } from "../../src/services/authService";
import { createAuthRuntimeService } from "../../src/services/auth/authRuntimeService";
import {
  initializeSupabaseAuthSessionBridge,
  type SupabaseAuthSessionBridgeOptions,
} from "../../src/services/auth/supabaseAuthSessionBridge";
import type { AuthSessionResult } from "../../src/types/auth";

const accessToken = "test-access-token";

const unverifiedSession: AuthSessionResult = {
  kind: "authenticated",
  status: "authenticated",
  message: "Backend identity verified. Workspace authority is not available yet.",
  identity: {
    userId: "verified-user",
    authProvider: "supabase",
    authSubject: "verified-subject",
    workspaceAuthority: "not_available",
    workspaceAuthorityReason: "no_active_workspace_membership",
  },
};

const verifiedSession: AuthSessionResult = {
  kind: "authenticated",
  status: "authenticated",
  message: "Backend session verified.",
  identity: {
    userId: "verified-user",
    authProvider: "supabase",
    authSubject: "verified-subject",
    workspaceId: "verified-workspace",
    workspaceRole: "workspace_owner",
    workspaceAuthority: "verified",
  },
};

const bootstrapComplete: BackendAccountBootstrapResponse = {
  kind: "account_bootstrap_complete",
  status: "authenticated",
  message: "Account setup complete.",
  identity: verifiedSession.identity,
  bootstrap: {
    appUserCreated: true,
    workspaceCreated: true,
    membershipCreated: true,
  },
};

interface RuntimeHarnessOptions {
  bootstrapResult?: BackendAccountBootstrapResponse;
  onSignIn?: () => void;
  sessions: AuthSessionResult[];
}

const createRuntimeHarness = ({
  bootstrapResult = bootstrapComplete,
  onSignIn,
  sessions,
}: RuntimeHarnessOptions) => {
  let bootstrapCount = 0;
  let sessionCount = 0;
  const sessionQueue = [...sessions];
  const dependencies = {
    bootstrapAccount: async () => {
      bootstrapCount += 1;
      return bootstrapResult;
    },
    getAuthSession: async () => {
      sessionCount += 1;
      return sessionQueue.shift() ?? sessions[sessions.length - 1];
    },
    getSupabaseAuthClient: () => ({
      kind: "supabase_auth_client_ready",
      auth: {
        signInWithPassword: async () => {
          onSignIn?.();
          return {
            ok: true as const,
            data: { accessToken },
          };
        },
      },
    }),
    logoutFromBackendAuth: async () => ({
      kind: "logged_out" as const,
      status: "unauthenticated" as const,
      message: "Signed out.",
    }),
  } as unknown as NonNullable<
    Parameters<typeof createAuthRuntimeService>[0]
  >;

  return {
    get bootstrapCount() {
      return bootstrapCount;
    },
    get sessionCount() {
      return sessionCount;
    },
    service: createAuthRuntimeService(dependencies),
  };
};

test("existing verified account completes login without a bootstrap mutation", async () => {
  const harness = createRuntimeHarness({ sessions: [verifiedSession] });

  const result = await harness.service.loginWithSupabaseRuntime({
    email: "existing@example.test",
    password: "not-a-real-password",
  });

  expect(result).toEqual(verifiedSession);
  expect(harness.sessionCount).toBe(1);
  expect(harness.bootstrapCount).toBe(0);
});

test("new confirmed account performs exactly one repair and returns the verified session", async () => {
  const harness = createRuntimeHarness({
    sessions: [unverifiedSession, verifiedSession],
  });

  const result = await harness.service.loginWithSupabaseRuntime({
    email: "new@example.test",
    password: "not-a-real-password",
  });

  expect(result).toEqual(verifiedSession);
  expect(harness.sessionCount).toBe(2);
  expect(harness.bootstrapCount).toBe(1);
});

test("concurrent SIGNED_IN defers to explicit password login repair ownership", async () => {
  let authStateCallback:
    | ((event: string, session: { accessToken?: string }) => void)
    | undefined;
  let bridgeRefreshCount = 0;
  let loginPending = false;
  const getAuthClient = (() => ({
    kind: "supabase_auth_client_ready",
    auth: {
      getAccessToken: async () => ({ ok: true as const, data: undefined }),
      onAuthStateChange: (
        callback: (event: string, session: { accessToken?: string }) => void,
      ) => {
        authStateCallback = callback;
        return { unsubscribe: () => undefined };
      },
    },
  })) as unknown as NonNullable<
    SupabaseAuthSessionBridgeOptions["getAuthClient"]
  >;

  const bridge = await initializeSupabaseAuthSessionBridge({
    getAuthClient,
    refreshBackendSession: async () => {
      bridgeRefreshCount += 1;
    },
    shouldDeferAuthStateEvent: (event) =>
      event === "SIGNED_IN" && loginPending,
  });
  bridgeRefreshCount = 0;

  try {
    const harness = createRuntimeHarness({
      onSignIn: () => authStateCallback?.("SIGNED_IN", { accessToken }),
      sessions: [unverifiedSession, verifiedSession],
    });

    loginPending = true;
    const result = await harness.service.loginWithSupabaseRuntime({
      email: "new@example.test",
      password: "not-a-real-password",
    });
    loginPending = false;

    expect(result).toEqual(verifiedSession);
    expect(harness.bootstrapCount).toBe(1);
    expect(harness.sessionCount).toBe(2);
    expect(bridgeRefreshCount).toBe(0);
  } finally {
    bridge.unsubscribe();
  }
});

const blockedCases: Array<{
  name: string;
  response: BackendAccountBootstrapResponse;
}> = [
  {
    name: "inactive membership",
    response: {
      kind: "workspace_bootstrap_blocked",
      status: "workspace_bootstrap_blocked",
      reason: "inactive_membership_exists",
      message: "This account does not have an active workspace membership.",
    },
  },
  {
    name: "multiple active memberships",
    response: {
      kind: "workspace_bootstrap_blocked",
      status: "workspace_selection_required",
      reason: "multiple_active_memberships",
      message: "Workspace selection is required.",
      identity: {
        ...unverifiedSession.identity,
        workspaceAuthorityReason: "multiple_active_workspace_memberships",
      },
    },
  },
];

for (const blockedCase of blockedCases) {
  test(`${blockedCase.name} is terminal and does not trigger a second repair or session read`, async () => {
    const harness = createRuntimeHarness({
      bootstrapResult: blockedCase.response,
      sessions: [unverifiedSession],
    });

    const result = await harness.service.loginWithSupabaseRuntime({
      email: "blocked@example.test",
      password: "not-a-real-password",
    });

    expect(result).toMatchObject({
      kind: "unavailable",
      status: "unavailable",
      code: "workspace_bootstrap_blocked",
    });
    expect(harness.bootstrapCount).toBe(1);
    expect(harness.sessionCount).toBe(1);
  });
}

test("store wiring preserves stale-revision logout safety and truthful blocked completion", () => {
  const root = resolve(process.cwd());
  const storeSource = readFileSync(resolve(root, "src/store/authStore.ts"), "utf8");
  const bridgeSource = readFileSync(
    resolve(root, "src/services/auth/supabaseAuthSessionBridge.ts"),
    "utf8",
  );

  expect(storeSource).toContain(
    'const revision = beginAuthRevision("login_pending", true);',
  );
  expect(storeSource).toContain('const revision = beginAuthRevision("logged_out", true);');
  expect(storeSource).toContain("if (!isCurrentRevision(revision))");
  expect(storeSource).toContain(
    'event === "SIGNED_IN" && useAuthStore.getState().pendingAction === "login"',
  );
  expect(storeSource).toContain('result.code === "workspace_bootstrap_blocked"');
  expect(storeSource).toContain("pendingAction: null");
  expect(bridgeSource).toContain("shouldDeferAuthStateEvent?.(event)");
  expect(bridgeSource).toContain('event === "PASSWORD_RECOVERY"');
  expect(bridgeSource).toContain('event === "INITIAL_SESSION"');
  expect(`${storeSource}\n${bridgeSource}`).not.toMatch(
    /console\.(?:log|debug|info|warn|error)\s*\(/,
  );
});
