import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  constructRemoteJwksForJwtVerification,
  createFailClosedFutureJwtVerificationStrategy,
  getJoseRuntimeImportBoundaryStatus,
} from "../../backend/auth/jwtProviderVerificationStrategy";
import { readJwtVerificationConfiguration } from "../../backend/auth/jwtVerificationConfiguration";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase125 jwt verification jwks construction boundary pack", () => {
  test("remote jwks construction boundary can construct a jose jwks resolver without enabling verification", async () => {
    expect(constructRemoteJwksForJwtVerification()).toEqual({
      kind: "not_constructed",
      reason: "missing_config",
      realVerificationEnabled: false,
    });

    expect(
      constructRemoteJwksForJwtVerification(readJwtVerificationConfiguration({})),
    ).toEqual({
      kind: "not_constructed",
      reason: "not_configured",
      realVerificationEnabled: false,
    });

    const configured = readJwtVerificationConfiguration({
      FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
      FREE_AI_MIXER_AUTH_ISSUER: "https://auth.example.test",
      FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
      FREE_AI_MIXER_AUTH_JWKS_URI: "https://auth.example.test/.well-known/jwks.json",
    });

    const constructed = constructRemoteJwksForJwtVerification(configured);

    expect(constructed.kind).toBe("constructed");
    expect(constructed.realVerificationEnabled).toBe(false);

    if (constructed.kind !== "constructed") {
      throw new Error("expected JWKS construction to succeed");
    }

    expect(constructed.jwksUri).toBe("https://auth.example.test/.well-known/jwks.json");
    expect(typeof constructed.jwks).toBe("function");
  });

  test("jwks construction exists but jwt verification execution and routes remain deferred", async () => {
    const jwtSource = readSource("backend/auth/jwtProviderVerificationStrategy.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const appSource = readSource("backend/app.ts");

    expect(getJoseRuntimeImportBoundaryStatus()).toEqual({
      jwtVerifyImported: true,
      createRemoteJWKSetImported: true,
      realVerificationEnabled: false,
    });

    expect(jwtSource).toContain('from "jose"');
    expect(jwtSource).toContain("createRemoteJWKSet");
    expect(jwtSource).toContain("constructRemoteJwksForJwtVerification");
    expect(jwtSource).toContain("new URL(");
    expect(jwtSource).toContain("realVerificationEnabled: false");

    expect(jwtSource).not.toContain("await jwtVerify");
    expect(jwtSource).not.toContain("jwtVerify(");

    const nonJwtBoundaryRuntimeSource =
      compositionSource + "\n" + middlewareSource + "\n" + appSource + "\n" + routeSource;

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

  test("jwks construction boundary keeps jwt strategy fail-closed and artifact delivery blocked", async () => {
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
