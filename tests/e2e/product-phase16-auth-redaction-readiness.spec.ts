import { expect, test } from "@playwright/test";
import { createSafeStructuredLogEvent } from "../../backend/observability/safeStructuredLogger";
import { resolveProductionAuthReadiness } from "../../backend/auth/productionAuthReadiness";

test.describe("product phase 16 auth redaction and readiness", () => {
  test("authorization cookie session token and spoof header payloads are redacted from logs", () => {
    const event = createSafeStructuredLogEvent({
      event: "auth.boundary.regression",
      severity: "warn",
      metadata: {
        authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.signature",
        cookie: "session_token=fake-cookie-token",
        sessionToken: "eyJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uIjoidmFsdWUifQ.signature",
        service_role: "supabase_service_role_secret",
        "x-user-id": "spoof-user",
        "x-workspace-id": "spoof-workspace",
        claims: {
          sub: "user-123",
          workspaceId: "workspace-123",
        },
      },
    });

    const serialized = JSON.stringify(event);

    expect(serialized).not.toContain("Bearer eyJhbGciOiJIUzI1NiJ9");
    expect(serialized).not.toContain("session_token=fake-cookie-token");
    expect(serialized).not.toContain("supabase_service_role_secret");
    expect(serialized).not.toContain("spoof-user");
    expect(serialized).not.toContain("spoof-workspace");
    expect(event.redactedFields).toEqual(
      expect.arrayContaining([
        "authorization",
        "cookie",
        "sessionToken",
        "service_role",
        "x-user-id",
        "x-workspace-id",
      ]),
    );
  });

  test("production auth readiness stays fail-closed on missing config and never exposes secrets", () => {
    const decision = resolveProductionAuthReadiness({
      FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
      FREE_AI_MIXER_AUTH_ISSUER: "https://issuer.example.com",
      FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
      FREE_AI_MIXER_CORS_ALLOWED_ORIGINS: "https://app.example.com",
    });

    expect(decision).toMatchObject({
      kind: "not_ready",
      routeRuntimeEnabled: false,
      realVerificationEnabled: false,
    });
    expect(JSON.stringify(decision)).not.toContain("service_role");
    expect(JSON.stringify(decision)).not.toContain("Bearer ");
  });
});
