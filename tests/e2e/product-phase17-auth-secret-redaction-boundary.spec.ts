import { expect, test } from "@playwright/test";
import { createSafeStructuredLogEvent } from "../../backend/observability/safeStructuredLogger";
import { resolveProductionAuthReadiness } from "../../backend/auth/productionAuthReadiness";

test.describe("product phase 17 auth secret redaction boundary", () => {
  test("authorization cookies tokens service-role values and spoof headers are redacted", () => {
    const event = createSafeStructuredLogEvent({
      event: "phase17.auth.secret.redaction",
      severity: "warn",
      metadata: {
        authorization: "Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature",
        cookie: "sb-access-token=access-secret; sb-refresh-token=refresh-secret",
        supabaseAccessToken: "eyJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIn0.signature",
        supabaseRefreshToken: "refresh-token-secret",
        serviceRoleKey: "supabase_service_role_real_secret",
        "x-user-id": "spoof-user",
        "x-workspace-id": "spoof-workspace",
      },
    });

    const serialized = JSON.stringify(event);

    expect(serialized).not.toContain("Bearer eyJhbGciOiJSUzI1NiJ9");
    expect(serialized).not.toContain("sb-access-token=access-secret");
    expect(serialized).not.toContain("refresh-secret");
    expect(serialized).not.toContain("supabase_service_role_real_secret");
    expect(serialized).not.toContain("spoof-user");
    expect(serialized).not.toContain("spoof-workspace");
  });

  test("auth readiness responses do not expose anon keys, service-role values, or raw tokens", () => {
    const readiness = resolveProductionAuthReadiness({
      FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
      FREE_AI_MIXER_AUTH_ISSUER: "https://issuer.example.com",
      FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
      FREE_AI_MIXER_AUTH_JWKS_URI: "https://issuer.example.com/.well-known/jwks.json",
      FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS: "RS256",
      FREE_AI_MIXER_CORS_ALLOWED_ORIGINS: "https://app.example.com",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_abc123",
      SUPABASE_SERVICE_ROLE_KEY: "supabase_service_role_abc123",
      AUTHORIZATION: "Bearer secret-token",
    } as never);

    const serialized = JSON.stringify(readiness);

    expect(serialized).not.toContain("sb_publishable_abc123");
    expect(serialized).not.toContain("supabase_service_role_abc123");
    expect(serialized).not.toContain("Bearer secret-token");
  });
});
