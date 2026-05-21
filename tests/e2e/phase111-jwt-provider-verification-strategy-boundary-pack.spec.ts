import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createFailClosedFutureJwtVerificationStrategy,
  createJwtVerificationNotConfiguredStrategy,
  mapJwtVerificationResultToRequesterContext,
} from "../../backend/auth/jwtProviderVerificationStrategy";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase111 jwt provider verification strategy boundary pack", () => {
  test("jwt verification strategies fail closed without real verification", async () => {
    const notConfiguredStrategy = createJwtVerificationNotConfiguredStrategy();

    expect(notConfiguredStrategy.kind).toBe("jwt_verification_not_configured");

    await expect(notConfiguredStrategy.verify()).resolves.toEqual({
      kind: "not_verified",
      reason: "auth_not_configured",
    });

    expect(
      mapJwtVerificationResultToRequesterContext({
        kind: "not_verified",
        reason: "auth_not_configured",
      }),
    ).toEqual({
      kind: "unauthenticated",
      reason: "auth_not_configured",
    });

    const futureStrategy = createFailClosedFutureJwtVerificationStrategy();

    expect(futureStrategy.kind).toBe("future_jwt_verification");

    await expect(futureStrategy.verify()).resolves.toEqual({
      kind: "not_verified",
      reason: "missing_credentials",
    });

    await expect(
      futureStrategy.verify({
        headers: {
          authorization: "Bearer fake-token-must-not-authenticate",
          "x-user-id": "fake-user-must-not-authenticate",
          "x-workspace-id": "fake-workspace-must-not-authenticate",
        },
        issuer: "https://auth.example.test",
        audience: "free-ai-mixer",
      }),
    ).resolves.toEqual({
      kind: "not_verified",
      reason: "invalid_credentials",
    });
  });

  test("jwt verification boundary exists but is not wired into provider composition routes or app", async () => {
    const jwtSource = readSource("backend/auth/jwtProviderVerificationStrategy.ts");
    const providerSource = readSource("backend/auth/trustedAuthProviderStrategy.ts");
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const appSource = readSource("backend/app.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    expect(jwtSource).toContain("TrustedJwtVerificationStrategy");
    expect(jwtSource).toContain("createJwtVerificationNotConfiguredStrategy");
    expect(jwtSource).toContain("createFailClosedFutureJwtVerificationStrategy");
    expect(jwtSource).toContain("mapJwtVerificationResultToRequesterContext");

    expect(providerSource).toContain("TrustedAuthProviderStrategy");
    expect(compositionSource).toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");
    expect(middlewareSource).toContain("createTrustedAuthMiddleware");
    expect(appSource).toContain("readTrustedAuthProviderRuntimeConfig");
    expect(routeSource).toContain("getRequesterContextFromRequest");

    expect(providerSource).not.toContain("createFailClosedFutureJwtVerificationStrategy");
    expect(compositionSource).not.toContain("createFailClosedFutureJwtVerificationStrategy");
    expect(middlewareSource).not.toContain("createFailClosedFutureJwtVerificationStrategy");
    expect(appSource).not.toContain("createFailClosedFutureJwtVerificationStrategy");
    expect(routeSource).not.toContain("createFailClosedFutureJwtVerificationStrategy");

    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("jwt strategy boundary does not introduce fake auth secrets frontend storage or artifact delivery", async () => {
    const authSource =
      readSource("backend/auth/jwtProviderVerificationStrategy.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderRuntimeConfig.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderComposition.ts") +
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
