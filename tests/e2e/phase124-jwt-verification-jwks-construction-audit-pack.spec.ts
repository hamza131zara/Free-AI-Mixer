import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createFailClosedFutureJwtVerificationStrategy,
  getJoseRuntimeImportBoundaryStatus,
  getJwtVerificationExecutionReadiness,
} from "../../backend/auth/jwtProviderVerificationStrategy";
import {
  isJwtVerificationConfigured,
  readJwtVerificationConfiguration,
} from "../../backend/auth/jwtVerificationConfiguration";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase124 jwt verification jwks construction audit pack", () => {
  test("remote jwks configuration can be represented but jwks construction remains deferred", async () => {
    const configured = readJwtVerificationConfiguration({
      FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
      FREE_AI_MIXER_AUTH_ISSUER: "https://auth.example.test",
      FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
      FREE_AI_MIXER_AUTH_JWKS_URI: "https://auth.example.test/.well-known/jwks.json",
    });

    expect(configured).toEqual({
      kind: "jwt_verification_configured",
      keyMode: "remote_jwks",
      issuer: "https://auth.example.test",
      audience: "free-ai-mixer",
      jwksUri: "https://auth.example.test/.well-known/jwks.json",
    });

    expect(isJwtVerificationConfigured(configured)).toBe(true);

    expect(getJwtVerificationExecutionReadiness(configured)).toEqual({
      realVerificationEnabled: false,
      verificationConfigured: true,
      keyMode: "remote_jwks",
    });

    expect(getJoseRuntimeImportBoundaryStatus()).toEqual({
      jwtVerifyImported: true,
      createRemoteJWKSetImported: true,
      realVerificationEnabled: false,
    });
  });

  test("jwt boundary imports jose but does not construct remote jwks or execute jwt verification yet", async () => {
    const jwtSource = readSource("backend/auth/jwtProviderVerificationStrategy.ts");
    const configSource = readSource("backend/auth/jwtVerificationConfiguration.ts");
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const appSource = readSource("backend/app.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    expect(configSource).toContain("FREE_AI_MIXER_AUTH_JWKS_URI");
    expect(configSource).toContain("remote_jwks");
    expect(jwtSource).toContain('from "jose"');
    expect(jwtSource).toContain("createRemoteJWKSet");
    expect(jwtSource).toContain("jwtVerify");
    expect(jwtSource).toContain("realVerificationEnabled: false");
    expect(jwtSource).toContain("getJwtVerificationExecutionReadiness");

    // Phase 124 is audit-only. JWKS construction and jwtVerify execution remain deferred.
    expect(jwtSource).not.toContain("await jwtVerify");
    expect(jwtSource).not.toContain("jwtVerify(");
    expect(jwtSource).toContain("constructRemoteJwksForJwtVerification");
    expect(jwtSource).toContain("new URL(");
        expect(jwtSource).toContain("jwksUri");

    const nonJwtBoundaryRuntimeSource =
      compositionSource + "\n" + middlewareSource + "\n" + appSource + "\n" + routeSource;

    expect(nonJwtBoundaryRuntimeSource).not.toContain('from "jose"');
    expect(nonJwtBoundaryRuntimeSource).not.toContain("jwtVerify");
    expect(nonJwtBoundaryRuntimeSource).not.toContain("createRemoteJWKSet");
    expect(nonJwtBoundaryRuntimeSource).not.toContain("readJwtVerificationConfiguration");

    expect(routeSource).toContain("getRequesterContextFromRequest");
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("jwks construction audit keeps jwt strategy fail-closed and artifact delivery blocked", async () => {
    const configured = readJwtVerificationConfiguration({
      FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
      FREE_AI_MIXER_AUTH_ISSUER: "https://auth.example.test",
      FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
      FREE_AI_MIXER_AUTH_JWKS_URI: "https://auth.example.test/.well-known/jwks.json",
    });

    const strategy = createFailClosedFutureJwtVerificationStrategy({
      verificationConfig: configured,
    });

    await expect(strategy.verify()).resolves.toEqual({
      kind: "not_verified",
      reason: "missing_credentials",
    });

    await expect(
      strategy.verify({
        headers: {
          authorization: "Bearer fake-token-must-not-authenticate",
          "x-user-id": "fake-user-must-not-authenticate",
          "x-workspace-id": "fake-workspace-must-not-authenticate",
        },
      }),
    ).resolves.toEqual({
      kind: "not_verified",
      reason: "invalid_credentials",
    });

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

