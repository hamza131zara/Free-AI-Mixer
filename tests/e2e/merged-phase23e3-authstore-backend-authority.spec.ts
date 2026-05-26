import { expect, test } from "@playwright/test";
import { useAuthStore } from "../../src/store/authStore";

test.describe("merged phase 23E-3 authstore backend authority", () => {
  test("backend session response remains canonical even when a bearer token is present", async () => {
    const originalFetch = globalThis.fetch;

    useAuthStore.setState({
      status: "unknown",
      identity: undefined,
      message: "Checking backend session status.",
      pendingAction: null,
      reasonCode: undefined,
    });

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          kind: "unauthenticated_session",
          status: "unauthenticated",
          reason: "invalid_credentials",
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

    try {
      await useAuthStore.getState().refreshSession("supabase-access-token");
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(useAuthStore.getState().identity).toBeUndefined();
    expect(useAuthStore.getState().reasonCode).toBe("invalid_credentials");
  });

  test("authstore becomes authenticated only from backend-authenticated session payload", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          kind: "authenticated_session",
          status: "authenticated",
          message: "Backend session verified.",
          identity: {
            userId: "phase23e3-user",
            workspaceAuthority: "verified",
            workspaceId: "workspace-123",
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

    try {
      await useAuthStore.getState().refreshSession("supabase-access-token");
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().identity).toEqual({
      userId: "phase23e3-user",
      workspaceAuthority: "verified",
      workspaceId: "workspace-123",
    });
  });
});
