import { expect, test } from "@playwright/test";
import { resolveProductionAuthReadiness } from "../../backend/auth/productionAuthReadiness";
import { resolveProductionJwtAuthReadiness } from "../../backend/auth/productionJwtAuthReadiness";

test.describe("product phase 17 jwt env readiness boundary", () => {
  test("jwt env readiness fails closed when config is incomplete", () => {
    expect(
      resolveProductionJwtAuthReadiness({
        FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
        FREE_AI_MIXER_AUTH_ISSUER: "https://issuer.example.com",
        FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
        FREE_AI_MIXER_AUTH_JWKS_URI: "https://issuer.example.com/.well-known/jwks.json",
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "missing_allowed_algorithms",
      providerConfigured: false,
      jwksConfigured: false,
      routeRuntimeEnabled: false,
      realVerificationEnabled: false,
    });
  });

  test("readiness output stays non-secret even when env values include anon or service-role data", () => {
    const readiness = resolveProductionAuthReadiness({
      FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
      FREE_AI_MIXER_AUTH_ISSUER: "https://issuer.example.com",
      FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
      FREE_AI_MIXER_AUTH_JWKS_URI: "https://issuer.example.com/.well-known/jwks.json",
      FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS: "RS256, ES256",
      FREE_AI_MIXER_CORS_ALLOWED_ORIGINS: "https://app.example.com",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test_123",
      VITE_SUPABASE_PUBLISHABLE_KEY: "another-public-key",
      SERVICE_ROLE_KEY: "supabase_service_role_should_never_show",
    } as never);

    const serialized = JSON.stringify(readiness);

    expect(readiness).toMatchObject({
      kind: "ready",
      routeRuntimeEnabled: false,
      realVerificationEnabled: false,
      frontendAnonKeyConfigured: true,
      frontendProjectUrlConfigured: true,
    });
    expect(serialized).not.toContain("sb_publishable_test_123");
    expect(serialized).not.toContain("another-public-key");
    expect(serialized).not.toContain("supabase_service_role_should_never_show");
  });
});
