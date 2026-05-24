import { expect, test } from "@playwright/test";
import { decideRequesterContext } from "../../backend/auth/requesterContextDecision";
import { resolveProductionAuthReadiness } from "../../backend/auth/productionAuthReadiness";
import { createTrustedAuthProviderStrategyFromRuntimeConfig } from "../../backend/auth/trustedAuthProviderComposition";

test.describe("product phase 16 requester context boundary", () => {
  test("requester context distinguishes verified authenticated unauthenticated and missing workspace states", () => {
    expect(
      decideRequesterContext({
        kind: "authenticated",
        userId: "user_1",
        workspaceId: "workspace_1",
        authProvider: "jwt",
        authSubject: "subject_1",
      }),
    ).toMatchObject({
      kind: "verified_authenticated",
    });

    expect(
      decideRequesterContext(
        {
          kind: "authenticated",
          userId: "user_2",
          authProvider: "jwt",
          authSubject: "subject_2",
        },
        { requireWorkspace: true },
      ),
    ).toMatchObject({
      kind: "missing_workspace",
    });

    expect(
      decideRequesterContext({
        kind: "unauthenticated",
        reason: "auth_not_configured",
      }),
    ).toMatchObject({
      kind: "auth_not_configured",
    });

    expect(
      decideRequesterContext({
        kind: "unauthenticated",
        reason: "missing_credentials",
      }),
    ).toMatchObject({
      kind: "missing_credentials",
    });

    expect(
      decideRequesterContext({
        kind: "unauthenticated",
        reason: "invalid_credentials",
      }),
    ).toMatchObject({
      kind: "invalid_credentials",
    });
  });

  test("requester context only becomes authenticated from verified provider-strategy output and ignores spoof headers", async () => {
    const authNotConfiguredStrategy = createTrustedAuthProviderStrategyFromRuntimeConfig({
      kind: "auth_provider_not_configured",
      reason: "missing_provider",
    });
    const jwtConfiguredStrategy = createTrustedAuthProviderStrategyFromRuntimeConfig({
      kind: "auth_provider_configured",
      provider: "future_jwt_provider",
      issuer: "https://issuer.example.com",
      audience: "free-ai-mixer",
    });

    await expect(
      authNotConfiguredStrategy.resolveRequesterContext({
        headers: {
          "x-user-id": "spoof-user",
          "x-workspace-id": "spoof-workspace",
        },
      }),
    ).resolves.toEqual({
      kind: "unauthenticated",
      reason: "auth_not_configured",
    });

    await expect(
      jwtConfiguredStrategy.resolveRequesterContext({
        headers: {
          authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.signature",
          "x-user-id": "spoof-user",
          "x-workspace-id": "spoof-workspace",
        },
      }),
    ).resolves.toEqual({
      kind: "unauthenticated",
      reason: "invalid_credentials",
    });
  });

  test("production auth readiness validates config only and stays non-executing", () => {
    expect(resolveProductionAuthReadiness({})).toMatchObject({
      kind: "not_ready",
      routeRuntimeEnabled: false,
      realVerificationEnabled: false,
    });

    expect(
      resolveProductionAuthReadiness({
        FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
        FREE_AI_MIXER_AUTH_ISSUER: "https://issuer.example.com",
        FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
        FREE_AI_MIXER_AUTH_JWKS_URI: "https://issuer.example.com/.well-known/jwks.json",
        FREE_AI_MIXER_AUTH_JWT_KEY_MODE: "remote_jwks",
        FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS: "RS256",
        FREE_AI_MIXER_CORS_ALLOWED_ORIGINS: "https://app.example.com",
        VITE_SUPABASE_URL: "https://project.supabase.co",
        VITE_SUPABASE_ANON_KEY: "sb_publishable_test_key",
      }),
    ).toMatchObject({
      kind: "ready",
      provider: "jwt",
      routeRuntimeEnabled: false,
      realVerificationEnabled: false,
    });
  });
});
