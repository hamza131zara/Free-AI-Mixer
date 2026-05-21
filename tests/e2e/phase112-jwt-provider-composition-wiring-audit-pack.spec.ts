import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createFailClosedFutureJwtVerificationStrategy,
  createJwtVerificationNotConfiguredStrategy,
} from "../../backend/auth/jwtProviderVerificationStrategy";
import { createTrustedAuthProviderStrategyFromRuntimeConfig } from "../../backend/auth/trustedAuthProviderComposition";
import { readTrustedAuthProviderRuntimeConfig } from "../../backend/auth/trustedAuthProviderRuntimeConfig";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase112 jwt provider composition wiring audit pack", () => {
  test("jwt verification boundary exists while provider composition still uses generic fail-closed jwt behavior", async () => {
    const jwtVerificationSource = readSource("backend/auth/jwtProviderVerificationStrategy.ts");
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");
    const configSource = readSource("backend/auth/trustedAuthProviderRuntimeConfig.ts");

    expect(jwtVerificationSource).toContain("TrustedJwtVerificationStrategy");
    expect(jwtVerificationSource).toContain("createJwtVerificationNotConfiguredStrategy");
    expect(jwtVerificationSource).toContain("createFailClosedFutureJwtVerificationStrategy");
    expect(jwtVerificationSource).toContain("mapJwtVerificationResultToRequesterContext");

    expect(configSource).toContain("future_jwt_provider");
    expect(compositionSource).toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");
    expect(compositionSource).toContain("invalid_credentials");

    // Phase 112 is audit-only. JWT verification strategy is not wired into composition yet.
    expect(compositionSource).not.toContain("createFailClosedFutureJwtVerificationStrategy");
    expect(compositionSource).not.toContain("createJwtVerificationNotConfiguredStrategy");
    expect(compositionSource).not.toContain("mapJwtVerificationResultToRequesterContext");

    const jwtBoundary = createFailClosedFutureJwtVerificationStrategy();

    await expect(
      jwtBoundary.verify({
        headers: {
          authorization: "Bearer fake-token-must-not-authenticate",
        },
      }),
    ).resolves.toEqual({
      kind: "not_verified",
      reason: "invalid_credentials",
    });

    const notConfiguredBoundary = createJwtVerificationNotConfiguredStrategy();

    await expect(notConfiguredBoundary.verify()).resolves.toEqual({
      kind: "not_verified",
      reason: "auth_not_configured",
    });

    const composedJwtStrategy = createTrustedAuthProviderStrategyFromRuntimeConfig(
      readTrustedAuthProviderRuntimeConfig({
        FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
      }),
    );

    expect(composedJwtStrategy.kind).toBe("future_jwt_provider");

    await expect(
      composedJwtStrategy.resolveRequesterContext({
        headers: {
          authorization: "Bearer fake-token-must-not-authenticate",
        },
      }),
    ).resolves.toEqual({
      kind: "unauthenticated",
      reason: "invalid_credentials",
    });
  });

  test("jwt composition wiring remains deferred from middleware app routes and server", async () => {
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const appSource = readSource("backend/app.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const serverSource = readSource("backend/server.ts");

    expect(middlewareSource).toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");
    expect(appSource).toContain("readTrustedAuthProviderRuntimeConfig");
    expect(routeSource).toContain("getRequesterContextFromRequest");

    // JWT verification strategy remains unwired.
    expect(compositionSource).not.toContain("createFailClosedFutureJwtVerificationStrategy");
    expect(middlewareSource).not.toContain("createFailClosedFutureJwtVerificationStrategy");
    expect(appSource).not.toContain("createFailClosedFutureJwtVerificationStrategy");
    expect(routeSource).not.toContain("createFailClosedFutureJwtVerificationStrategy");
    expect(serverSource).not.toContain("createFailClosedFutureJwtVerificationStrategy");

    // Route authorization remains deferred.
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("jwt composition audit does not introduce fake auth secrets frontend storage or artifact delivery", async () => {
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
