import { expect, test } from "@playwright/test";
import { readFrontendSupabaseAuthReadiness } from "../../src/services/auth/supabaseAuthReadiness";

test.describe("merged phase 23E-1 auth readiness fail closed", () => {
  test("readiness helper stays non-runtime and fails closed for missing public env", () => {
    expect(readFrontendSupabaseAuthReadiness({})).toEqual({
      kind: "supabase_auth_not_configured",
      reason: "missing_supabase_url",
    });

    expect(
      readFrontendSupabaseAuthReadiness({
        VITE_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toEqual({
      kind: "supabase_auth_not_configured",
      reason: "missing_supabase_anon_key",
    });
  });

  test("readiness helper rejects public service-role-like env exposure", () => {
    expect(
      readFrontendSupabaseAuthReadiness({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_ANON_KEY: "public-anon-key",
        VITE_ANY_SERVICE_ROLE_KEY: "forbidden",
      }),
    ).toEqual({
      kind: "supabase_auth_not_configured",
      reason: "service_role_env_forbidden",
      forbiddenEnvKey: "VITE_ANY_SERVICE_ROLE_KEY",
    });
  });

  test("readiness helper reports configured only for future public auth-only envs", () => {
    expect(
      readFrontendSupabaseAuthReadiness({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_ANON_KEY: "public-anon-key",
      }),
    ).toEqual({
      kind: "supabase_auth_configured",
      projectUrl: "https://example.supabase.co",
      anonKey: "public-anon-key",
    });
  });
});
