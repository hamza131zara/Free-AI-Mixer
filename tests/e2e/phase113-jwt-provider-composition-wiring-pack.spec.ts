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

test.describe("phase113 jwt provider composition wiring pack", () => {
  test("jwt provider composition delegates to fail-closed jwt verification boundary", async () => {
    const jwtStrategy = createTrustedAuthProviderStrategyFromRuntimeConfig(
      readTrustedAuthProviderRuntimeConfig({
        FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
        FREE_AI_MIXER_AUTH_ISSUER: "https://auth.example.test",
        FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
      }),
    );

    expect(jwtStrategy.kind).toBe("future_jwt_provider");

    await expect(jwtStrategy.resolveRequesterContext()).resolves.toEqual({
      kind: "unauthenticated",
      reason: "missing_credentials",
    });

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

    await expect(sessionStrategy.resolveRequesterContext()).resolves.toEqual({
      kind: "unauthenticated",
      reason: "invalid_credentials",
    });
  });

  test("jwt composition wiring exists but routes remain non-enforcing", async () => {
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");
    const jwtSource = readSource("backend/auth/jwtProviderVerificationStrategy.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const appSource = readSource("backend/app.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const serverSource = readSource("backend/server.ts");

    expect(compositionSource).toContain("createFailClosedFutureJwtVerificationStrategy");
    expect(compositionSource).toContain("mapJwtVerificationResultToRequesterContext");
    expect(jwtSource).toContain("createFailClosedFutureJwtVerificationStrategy");
    expect(jwtSource).toContain("mapJwtVerificationResultToRequesterContext");

    expect(middlewareSource).toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");
    expect(appSource).toContain("readTrustedAuthProviderRuntimeConfig");
    expect(routeSource).toContain("getRequesterContextFromRequest");

    // No real JWT verification dependency or implementation yet.
    expect(compositionSource + jwtSource + middlewareSource + appSource + serverSource).not.toContain("jwtVerify");
    expect(compositionSource + jwtSource + middlewareSource + appSource + serverSource).not.toContain("jsonwebtoken");
    expect(compositionSource + jwtSource + middlewareSource + appSource + serverSource).not.toContain("jose");
    expect(compositionSource + jwtSource + middlewareSource + appSource + serverSource).not.toContain("JWKS");
    expect(compositionSource + jwtSource + middlewareSource + appSource + serverSource).not.toContain("JWK");

    // Route authorization remains deferred.
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("jwt composition wiring does not introduce fake auth frontend storage or artifact delivery", async () => {
    const authSource =
      readSource("backend/auth/jwtProviderVerificationStrategy.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderComposition.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderRuntimeConfig.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderStrategy.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthMiddleware.ts");

    const routeSource = readSource("backend/routes/exports.ts");

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

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("x-user-id");
    expect(routeSource).not.toContain("x-workspace-id");

    expect(authSource).not.toContain("fakeSession");
    expect(authSource).not.toContain("mockAuthenticatedUser");
    expect(authSource).not.toContain("service_role");
    expect(authSource).not.toContain("SERVICE_ROLE");
    expect(authSource).not.toContain("PRIVATE_KEY");
    expect(authSource).not.toContain("AUTH_SECRET");
    expect(authSource).not.toContain("jwtVerify");
    expect(authSource).not.toContain("jsonwebtoken");
    expect(authSource).not.toContain("jose");
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
  });
});
