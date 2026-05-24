import { expect, test } from "@playwright/test";
import { resolveProductionAuthReadiness } from "../../backend/auth/productionAuthReadiness";
import { resolveSupabaseAuthRuntimeStrategy } from "../../backend/auth/supabaseAuthRuntimeStrategy";

test.describe("product phase 17 supabase auth strategy boundary", () => {
  test("supabase auth runtime strategy remains readiness only", () => {
    expect(resolveSupabaseAuthRuntimeStrategy()).toEqual({
      kind: "planned_supabase_auth_runtime",
      strategy: "frontend_supabase_auth_plus_backend_bearer_jwt",
      frontendSessionSource: "planned_supabase_auth_client",
      backendVerificationSource: "planned_supabase_jwks_bearer_verification",
      workspaceLookupSource: "planned_app_database_membership_lookup",
      liveRuntimeEnabled: false,
      jwtVerificationEnabled: false,
      workspaceLookupEnabled: false,
      serviceRoleFrontendAllowed: false,
      trustedHeaderIdentityAllowed: false,
      fakeSessionAllowed: false,
    });
  });

  test("production auth readiness exposes planned strategy metadata without enabling runtime", () => {
    const readiness = resolveProductionAuthReadiness({
      FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
      FREE_AI_MIXER_AUTH_ISSUER: "https://issuer.example.com",
      FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
      FREE_AI_MIXER_AUTH_JWKS_URI: "https://issuer.example.com/.well-known/jwks.json",
      FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS: "RS256",
      FREE_AI_MIXER_CORS_ALLOWED_ORIGINS: "https://app.example.com",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
    });

    expect(readiness).toMatchObject({
      kind: "ready",
      routeRuntimeEnabled: false,
      realVerificationEnabled: false,
      strategy: {
        kind: "planned_supabase_auth_runtime",
        liveRuntimeEnabled: false,
        jwtVerificationEnabled: false,
        workspaceLookupEnabled: false,
        serviceRoleFrontendAllowed: false,
      },
    });
  });
});
