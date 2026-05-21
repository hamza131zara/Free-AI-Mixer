import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  getJwtVerificationDependencyDecision,
  isJwtVerificationDependencyInstalledYet,
} from "../../backend/auth/jwtVerificationDependencyDecision";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase118 jwt verification runtime import audit pack", () => {
  test("jose is installed and selected", async () => {
    expect(getJwtVerificationDependencyDecision()).toEqual({
      kind: "selected",
      packageName: "jose",
      reason: "modern_jwks_and_jwt_verify_support",
    });

    expect(isJwtVerificationDependencyInstalledYet()).toBe(true);

    const packageJson = JSON.parse(readSource("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const packageLockSource = readSource("package-lock.json");

    expect(packageJson.dependencies ?? {}).toHaveProperty("jose");
    expect(packageLockSource).toContain('"jose"');

    expect(packageJson.dependencies ?? {}).not.toHaveProperty("jsonwebtoken");
    expect(packageJson.devDependencies ?? {}).not.toHaveProperty("jsonwebtoken");
    expect(packageLockSource).not.toContain('"jsonwebtoken"');
  });

  test("jose runtime import is isolated to jwt boundary and real verification remains disabled", async () => {
    const jwtSource = readSource("backend/auth/jwtProviderVerificationStrategy.ts");
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const appSource = readSource("backend/app.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    expect(jwtSource).toContain('from "jose"');
    expect(jwtSource).toContain("jwtVerify");
    expect(jwtSource).toContain("createRemoteJWKSet");
    expect(jwtSource).toContain("realVerificationEnabled: false");
    expect(jwtSource).toContain("createFailClosedFutureJwtVerificationStrategy");
    expect(jwtSource).toContain("missing_credentials");
    expect(jwtSource).toContain("invalid_credentials");

    expect(compositionSource).toContain("createFailClosedFutureJwtVerificationStrategy");
    expect(compositionSource).toContain("mapJwtVerificationResultToRequesterContext");

    const nonJwtBoundaryRuntimeSource = compositionSource + "\n" + middlewareSource + "\n" + appSource;

    expect(nonJwtBoundaryRuntimeSource).not.toContain('from "jose"');
    expect(nonJwtBoundaryRuntimeSource).not.toContain("jwtVerify");
    expect(nonJwtBoundaryRuntimeSource).not.toContain("createRemoteJWKSet");

    expect(routeSource).toContain("getRequesterContextFromRequest");
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("runtime import audit keeps fake auth frontend storage and artifact delivery blocked", async () => {
    const routeSource = readSource("backend/routes/exports.ts");

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
