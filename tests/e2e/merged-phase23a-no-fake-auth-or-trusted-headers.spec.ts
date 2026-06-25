import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createTrustedAuthProviderStrategyFromRuntimeConfig } from "../../backend/auth/trustedAuthProviderComposition";
import { createAuthNotConfiguredTrustedAuthProviderStrategy } from "../../backend/auth/trustedAuthProviderStrategy";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 23A no fake auth or trusted headers", () => {
  test("trusted headers cannot authenticate and no fake frontend auth client is added", async () => {
    const authNotConfiguredStrategy =
      createAuthNotConfiguredTrustedAuthProviderStrategy();
    const runtimeConfig = {
      kind: "auth_provider_configured" as const,
      provider: "future_jwt_provider" as const,
      issuer: "https://issuer.example.test/auth/v1",
      audience: "authenticated",
    };
    const previousJwtEnv = {
      FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS:
        process.env.FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS,
      FREE_AI_MIXER_AUTH_AUDIENCE: process.env.FREE_AI_MIXER_AUTH_AUDIENCE,
      FREE_AI_MIXER_AUTH_ISSUER: process.env.FREE_AI_MIXER_AUTH_ISSUER,
      FREE_AI_MIXER_AUTH_JWKS_URI: process.env.FREE_AI_MIXER_AUTH_JWKS_URI,
      FREE_AI_MIXER_AUTH_JWT_KEY_MODE:
        process.env.FREE_AI_MIXER_AUTH_JWT_KEY_MODE,
      FREE_AI_MIXER_AUTH_PROVIDER: process.env.FREE_AI_MIXER_AUTH_PROVIDER,
      FREE_AI_MIXER_AUTH_RUNTIME_ENABLED:
        process.env.FREE_AI_MIXER_AUTH_RUNTIME_ENABLED,
    };

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

    try {
      process.env.FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS = "ES256";
      process.env.FREE_AI_MIXER_AUTH_AUDIENCE = runtimeConfig.audience;
      process.env.FREE_AI_MIXER_AUTH_ISSUER = runtimeConfig.issuer;
      process.env.FREE_AI_MIXER_AUTH_JWKS_URI =
        "https://issuer.example.test/auth/v1/.well-known/jwks.json";
      process.env.FREE_AI_MIXER_AUTH_JWT_KEY_MODE = "remote_jwks";
      process.env.FREE_AI_MIXER_AUTH_PROVIDER = "jwt";
      process.env.FREE_AI_MIXER_AUTH_RUNTIME_ENABLED = "1";

      const jwtConfiguredStrategy =
        createTrustedAuthProviderStrategyFromRuntimeConfig(runtimeConfig);

      await expect(
        jwtConfiguredStrategy.resolveRequesterContext({
          headers: {
            "x-user-id": "spoof-user",
            "x-workspace-id": "spoof-workspace",
          },
        }),
      ).resolves.toEqual({
        kind: "unauthenticated",
        reason: "missing_credentials",
      });

      await expect(
        jwtConfiguredStrategy.resolveRequesterContext({
          headers: {
            authorization: "Bearer fake-token-must-not-authenticate",
            "x-user-id": "spoof-user",
            "x-workspace-id": "spoof-workspace",
          },
        }),
      ).resolves.toEqual({
        kind: "unauthenticated",
        reason: "invalid_credentials",
      });
    } finally {
      for (const [key, value] of Object.entries(previousJwtEnv)) {
        if (typeof value === "undefined") {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }

    const frontendSources = [
      readSource("src/services/authService.ts"),
      readSource("src/store/authStore.ts"),
      readSource("src/pages/LoginPage.tsx"),
      readSource("src/pages/SignupPage.tsx"),
      readSource("src/App.tsx"),
      readSource("src/main.tsx"),
    ].join("\n");

    expect(frontendSources).not.toContain("createClient(");
    expect(frontendSources).not.toContain(".auth.signIn");
    expect(frontendSources).not.toContain(".storage.from(");
    expect(frontendSources).not.toContain("service_role");
    expect(frontendSources).not.toContain("VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY");
    expect(frontendSources).not.toContain("mockAuthenticatedUser");
    expect(frontendSources).not.toContain("fakeSession");
  });
});
