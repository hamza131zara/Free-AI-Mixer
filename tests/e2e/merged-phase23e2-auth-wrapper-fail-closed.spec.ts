import { expect, test } from "@playwright/test";

import {
  getSupabaseAuthClient,
  getSupabaseAuthClientStatus,
} from "../../src/services/auth/supabaseAuthClient";

test.describe("merged phase 23E-2 auth wrapper fail closed", () => {
  test("wrapper reports disabled when public env is missing or invalid", () => {
    expect(getSupabaseAuthClientStatus({})).toEqual({
      kind: "supabase_auth_client_disabled",
      reason: "missing_supabase_url",
    });

    expect(
      getSupabaseAuthClientStatus({
        VITE_SUPABASE_URL: "not-a-url",
        VITE_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toEqual({
      kind: "supabase_auth_client_disabled",
      reason: "invalid_supabase_url",
    });

    expect(
      getSupabaseAuthClientStatus({
        VITE_SUPABASE_ANON_KEY: "anon-key",
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_SERVICE_ROLE_KEY: "forbidden",
      }),
    ).toEqual({
      forbiddenEnvKey: "VITE_SUPABASE_SERVICE_ROLE_KEY",
      kind: "supabase_auth_client_disabled",
      reason: "service_role_env_forbidden",
    });
  });

  test("wrapper returns no auth handle when disabled", () => {
    const result = getSupabaseAuthClient({
      VITE_SUPABASE_ANON_KEY: "anon-key",
      VITE_SUPABASE_URL: "invalid-url",
    });

    expect(result.kind).toBe("supabase_auth_client_disabled");
    expect("auth" in result).toBe(false);
  });
});
