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
    const jwtConfiguredStrategy =
      createTrustedAuthProviderStrategyFromRuntimeConfig({
        kind: "auth_provider_configured",
        provider: "future_jwt_provider",
        issuer: "https://issuer.example.test/auth/v1",
        audience: "authenticated",
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
