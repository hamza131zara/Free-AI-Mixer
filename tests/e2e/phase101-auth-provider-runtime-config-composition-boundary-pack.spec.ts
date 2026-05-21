import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createTrustedAuthProviderStrategyFromRuntimeConfig } from "../../backend/auth/trustedAuthProviderComposition";
import { readTrustedAuthProviderRuntimeConfig } from "../../backend/auth/trustedAuthProviderRuntimeConfig";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase101 auth provider runtime config composition boundary pack", () => {
  test("runtime config composes to fail-closed provider strategies without authenticating users", async () => {
    const missingConfig = readTrustedAuthProviderRuntimeConfig({});
    const missingStrategy =
      createTrustedAuthProviderStrategyFromRuntimeConfig(missingConfig);

    expect(missingStrategy.kind).toBe("auth_not_configured_provider");

    await expect(
      missingStrategy.resolveRequesterContext({
        headers: {
          authorization: "Bearer fake-token-must-not-authenticate",
        },
      }),
    ).resolves.toEqual({
      kind: "unauthenticated",
      reason: "auth_not_configured",
    });

    const jwtConfig = readTrustedAuthProviderRuntimeConfig({
      FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
      FREE_AI_MIXER_AUTH_ISSUER: "https://auth.example.test",
      FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
    });

    const jwtStrategy = createTrustedAuthProviderStrategyFromRuntimeConfig(jwtConfig);

    expect(jwtStrategy.kind).toBe("future_jwt_provider");

    await expect(
      jwtStrategy.resolveRequesterContext({
        headers: {
          authorization: "Bearer fake-token-must-not-authenticate",
          "x-user-id": "fake-user-must-not-authenticate",
          "x-workspace-id": "fake-workspace-must-not-authenticate",
        },
      }),
    ).resolves.toEqual({
      kind: "unauthenticated",
      reason: "invalid_credentials",
    });

    const sessionConfig = readTrustedAuthProviderRuntimeConfig({
      FREE_AI_MIXER_AUTH_PROVIDER: "session",
    });

    const sessionStrategy =
      createTrustedAuthProviderStrategyFromRuntimeConfig(sessionConfig);

    expect(sessionStrategy.kind).toBe("future_session_provider");

    await expect(sessionStrategy.resolveRequesterContext()).resolves.toEqual({
      kind: "unauthenticated",
      reason: "invalid_credentials",
    });
  });

  test("composition boundary remains unwired from app middleware routes and server", async () => {
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");
    const configSource = readSource("backend/auth/trustedAuthProviderRuntimeConfig.ts");
    const providerSource = readSource("backend/auth/trustedAuthProviderStrategy.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const appSource = readSource("backend/app.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const serverSource = readSource("backend/server.ts");

    expect(compositionSource).toContain(
      "createTrustedAuthProviderStrategyFromRuntimeConfig",
    );
    expect(compositionSource).toContain("TrustedAuthProviderRuntimeConfig");
    expect(configSource).toContain("readTrustedAuthProviderRuntimeConfig");
    expect(providerSource).toContain("TrustedAuthProviderStrategy");
    expect(middlewareSource).toContain("createTrustedAuthMiddleware");

    // Phase 101 adds composition boundary only. No app/middleware/route/server wiring yet.
    expect(middlewareSource).not.toContain(
      "createTrustedAuthProviderStrategyFromRuntimeConfig",
    );
    expect(appSource).not.toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");
    expect(routeSource).not.toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");
    expect(serverSource).not.toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");

    expect(appSource).toContain("createTrustedAuthNotConfiguredMiddleware");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("composition boundary does not introduce fake auth secrets frontend storage or artifact delivery", async () => {
    const authSource =
      readSource("backend/auth/trustedAuthProviderComposition.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderRuntimeConfig.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderStrategy.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthMiddleware.ts");

    const frontendSource =
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/types/exportJob.ts") +
      "\n" +
      readIfExists("src/services/exportHandleStorage.ts");

    const artifactSource =
      readIfExists("backend/artifacts/artifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/localDevArtifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/notConfiguredArtifactAccessProvider.ts");

    const docsSource =
      readIfExists("docs/known-issues.md") + "\n" + readIfExists("docs/phases.md");

    expect(authSource).not.toContain("fakeSession");
    expect(authSource).not.toContain("mockAuthenticatedUser");
    expect(authSource).not.toContain("service_role");
    expect(authSource).not.toContain("SERVICE_ROLE");
    expect(authSource).not.toContain("PRIVATE_KEY");
    expect(authSource).not.toContain("AUTH_SECRET");
    expect(authSource).not.toContain("createSignedUrl");
    expect(authSource).not.toContain("getPublicUrl");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");

    expect(artifactSource).not.toContain("production_ready_local_dev_stream");
    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("getPublicUrl");

    expect(docsSource).toContain("auth");
    expect(docsSource).toContain("RLS");
    expect(docsSource).toContain("ownership");
  });
});
