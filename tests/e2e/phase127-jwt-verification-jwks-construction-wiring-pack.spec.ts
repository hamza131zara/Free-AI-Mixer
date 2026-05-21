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

const countOccurrences = (source: string, value: string): number =>
  source.split(value).length - 1;

test.describe("phase127 jwt verification jwks construction wiring pack", () => {
  test("fail-closed jwt verify path now wires jwks construction without authenticating", async () => {
    const configured = readJwtVerificationConfiguration({
      FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
      FREE_AI_MIXER_AUTH_ISSUER: "https://auth.example.test",
      FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
      FREE_AI_MIXER_AUTH_JWKS_URI: "https://auth.example.test/.well-known/jwks.json",
    });

    const constructed = constructRemoteJwksForJwtVerification(configured);

    expect(constructed.kind).toBe("constructed");

    if (constructed.kind !== "constructed") {
      throw new Error("expected JWKS construction boundary to construct");
    }

    expect(typeof constructed.jwks).toBe("function");
    expect(constructed.realVerificationEnabled).toBe(false);

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
  });

  test("jwks construction is wired into jwt boundary while jwtVerify execution remains deferred", async () => {
    const jwtSource = readSource("backend/auth/jwtProviderVerificationStrategy.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const appSource = readSource("backend/app.ts");
    const serverSource = readSource("backend/server.ts");

    expect(getJoseRuntimeImportBoundaryStatus()).toEqual({
      jwtVerifyImported: true,
      createRemoteJWKSetImported: true,
      realVerificationEnabled: false,
    });

    expect(jwtSource).toContain("constructRemoteJwksForJwtVerification");
    expect(jwtSource).toContain("void constructRemoteJwksForJwtVerification(options.verificationConfig)");
    expect(countOccurrences(jwtSource, "constructRemoteJwksForJwtVerification")).toBeGreaterThan(1);
    expect(jwtSource).toContain("createRemoteJWKSet");
    expect(jwtSource).toContain("new URL(");
    expect(jwtSource).toContain("realVerificationEnabled: false");

    // Phase 127 wires JWKS construction only. jwtVerify execution remains deferred.
    expect(jwtSource).not.toContain("await jwtVerify");
    expect(jwtSource).not.toContain("jwtVerify(");

    const nonJwtBoundaryRuntimeSource =
      compositionSource +
      "\n" +
      middlewareSource +
      "\n" +
      appSource +
      "\n" +
      routeSource +
      "\n" +
      serverSource;

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

  test("jwks construction wiring keeps fake auth frontend storage and artifact delivery blocked", async () => {
    const routeSource = readSource("backend/routes/exports.ts");

    const authSource =
      readSource("backend/auth/jwtProviderVerificationStrategy.ts") +
      "\n" +
      readSource("backend/auth/jwtVerificationConfiguration.ts") +
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
