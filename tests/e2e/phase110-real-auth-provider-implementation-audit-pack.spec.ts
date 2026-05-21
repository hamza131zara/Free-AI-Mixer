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

test.describe("phase110 real auth provider implementation audit pack", () => {
  test("future jwt and session provider strategies still fail closed without real verification", async () => {
    const jwtStrategy = createTrustedAuthProviderStrategyFromRuntimeConfig(
      readTrustedAuthProviderRuntimeConfig({
        FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
        FREE_AI_MIXER_AUTH_ISSUER: "https://auth.example.test",
        FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
      }),
    );

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

    const sessionStrategy = createTrustedAuthProviderStrategyFromRuntimeConfig(
      readTrustedAuthProviderRuntimeConfig({
        FREE_AI_MIXER_AUTH_PROVIDER: "session",
      }),
    );

    expect(sessionStrategy.kind).toBe("future_session_provider");

    await expect(
      sessionStrategy.resolveRequesterContext({
        headers: {
          cookie: "fake-session=must-not-authenticate",
        },
      }),
    ).resolves.toEqual({
      kind: "unauthenticated",
      reason: "invalid_credentials",
    });
  });

  test("auth provider implementation remains deferred while boundaries are present", async () => {
    const providerSource = readSource("backend/auth/trustedAuthProviderStrategy.ts");
    const configSource = readSource("backend/auth/trustedAuthProviderRuntimeConfig.ts");
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const appSource = readSource("backend/app.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const serverSource = readSource("backend/server.ts");

    expect(providerSource).toContain("TrustedAuthProviderStrategy");
    expect(configSource).toContain("readTrustedAuthProviderRuntimeConfig");
    expect(compositionSource).toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");
    expect(middlewareSource).toContain("createTrustedAuthMiddleware");

    expect(appSource).toContain("runtimeConfig: readTrustedAuthProviderRuntimeConfig()");
    expect(routeSource).toContain("getRequesterContextFromRequest");

    // Phase 110 is audit-only. Real token/session verification remains deferred.
    expect(providerSource + compositionSource + middlewareSource).not.toContain("jwtVerify");
    expect(providerSource + compositionSource + middlewareSource).not.toContain("verifyJwt");
    expect(providerSource + compositionSource + middlewareSource).not.toContain("verifySession");
    expect(providerSource + compositionSource + middlewareSource).not.toContain("getSession");
    expect(providerSource + compositionSource + middlewareSource).not.toContain("JWK");
    expect(providerSource + compositionSource + middlewareSource).not.toContain("JWKS");
    expect(providerSource + compositionSource + middlewareSource).not.toContain("jose");
    expect(providerSource + compositionSource + middlewareSource).not.toContain("jsonwebtoken");

    // Routes/server still do not enforce authorization.
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");

    expect(serverSource).not.toContain("jwtVerify");
    expect(serverSource).not.toContain("verifySession");
  });

  test("real auth audit keeps trusted headers rls frontend storage and artifact delivery blocked", async () => {
    const routeSource = readSource("backend/routes/exports.ts");

    const authSource =
      readSource("backend/app.ts") +
      "\n" +
      readSource("backend/routes/exports.ts") +
      "\n" +
      readSource("backend/auth/requesterContext.ts") +
      "\n" +
      readSource("backend/auth/requesterContextResolver.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthMiddleware.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderRuntimeConfig.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderComposition.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderStrategy.ts") +
      "\n" +
      readSource("backend/auth/exportRequesterContextAdapter.ts") +
      "\n" +
      readSource("backend/auth/exportAuthorization.ts") +
      "\n" +
      readSource("backend/auth/exportAuthorizationRouteGuard.ts");

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

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("x-user-id");
    expect(routeSource).not.toContain("x-workspace-id");

    expect(routeSource).not.toContain("workspace membership");
    expect(routeSource).not.toContain("membershipRepository");
    expect(routeSource).not.toContain("isWorkspaceMember");
    expect(routeSource).not.toContain("applyRls");

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
