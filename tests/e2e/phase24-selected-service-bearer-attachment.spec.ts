import { expect, test } from "@playwright/test";
import { createAuthenticatedFetch } from "../../src/services/auth/authenticatedFetch";

test.describe("phase24 selected service bearer attachment", () => {
  test("attaches bearer only to the approved account routes and leaves public routes bearer-free", async () => {
    const fetchCalls: Array<{ headers?: Record<string, string>; url: string }> = [];
    const authenticatedFetch = createAuthenticatedFetch({
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        const headerRecord = Object.fromEntries(headers.entries());
        fetchCalls.push({
          headers: Object.keys(headerRecord).length > 0 ? headerRecord : undefined,
          url: String(input),
        });

        return new Response("{}", {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
      },
      getSupabaseAuthClient: () => ({
        kind: "supabase_auth_client_ready",
        auth: {
          getAccessToken: async () => ({
            ok: true,
            data: "phase24-token",
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
          requestPasswordReset: async () => ({
            ok: true,
            data: undefined,
          }),
          updatePassword: async () => ({
            ok: true,
            data: undefined,
          }),
        },
      }),
    });

    await authenticatedFetch("/project-library/projects", { method: "GET" });
    await authenticatedFetch("/project-library/history", { method: "GET" });
    await authenticatedFetch("/provider-settings/status", { method: "GET" });
    await authenticatedFetch("/credits/status", { method: "GET" });
    await authenticatedFetch("/credits/policy", { method: "GET" });
    await authenticatedFetch("/billing/plans", { method: "GET" });
    await authenticatedFetch("/generation/runtime-status", { method: "GET" });

    expect(fetchCalls).toEqual([
      {
        headers: {
          authorization: "Bearer phase24-token",
        },
        url: "/project-library/projects",
      },
      {
        headers: {
          authorization: "Bearer phase24-token",
        },
        url: "/project-library/history",
      },
      {
        headers: {
          authorization: "Bearer phase24-token",
        },
        url: "/provider-settings/status",
      },
      {
        headers: {
          authorization: "Bearer phase24-token",
        },
        url: "/credits/status",
      },
      {
        headers: undefined,
        url: "/credits/policy",
      },
      {
        headers: undefined,
        url: "/billing/plans",
      },
      {
        headers: undefined,
        url: "/generation/runtime-status",
      },
    ]);
  });
});
