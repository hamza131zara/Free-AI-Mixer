import { expect, test } from "@playwright/test";
import { initializeSupabaseAuthSessionBridge } from "../../src/services/auth/supabaseAuthSessionBridge";
import { initializeAuthStore, useAuthStore } from "../../src/store/authStore";

const waitForMicrotasks = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

test.describe("merged phase 23E-3 auth session bridge fail closed", () => {
  test("bridge disables itself without public env and backend-only session refresh still works", async () => {
    let refreshCalls = 0;

    const bridge = await initializeSupabaseAuthSessionBridge({
      refreshBackendSession: async () => {
        refreshCalls += 1;
      },
    });

    expect(bridge.kind).toBe("supabase_auth_session_bridge_disabled");
    expect(refreshCalls).toBe(0);

    useAuthStore.setState({
      status: "unknown",
      identity: undefined,
      message: "Checking backend session status.",
      pendingAction: null,
      reasonCode: undefined,
    });

    const originalFetch = globalThis.fetch;
    const fetchCalls: Array<{ headers?: HeadersInit; url: string }> = [];

    globalThis.fetch = async (input, init) => {
      fetchCalls.push({
        headers: init?.headers,
        url: String(input),
      });

      return new Response(
        JSON.stringify({
          kind: "unauthenticated_session",
          status: "unauthenticated",
          reason: "missing_credentials",
          message:
            "Sign in is required before protected account routes can show verified data.",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    };

    try {
      initializeAuthStore();
      await waitForMicrotasks();
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(fetchCalls).toEqual([
      {
        headers: undefined,
        url: "/auth/session",
      },
    ]);
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });
});
