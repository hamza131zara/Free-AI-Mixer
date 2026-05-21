import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  isJwtVerificationConfigured,
  readJwtVerificationConfiguration,
} from "../../backend/auth/jwtVerificationConfiguration";
import { getJoseRuntimeImportBoundaryStatus } from "../../backend/auth/jwtProviderVerificationStrategy";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase122 jwt verification configuration wiring audit pack", () => {
  test("jwt verification config boundary exists and can represent remote jwks config", async () => {
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

    expect(readJwtVerificationConfiguration({})).toEqual({
      kind: "jwt_verification_not_configured",
      reason: "missing_provider",
    });
  });

  test("jwt verification config remains unwired from execution composition middleware app and routes", async () => {
    const configSource = readSource("backend/auth/jwtVerificationConfiguration.ts");
    const jwtSource = readSource("backend/auth/jwtProviderVerificationStrategy.ts");
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const appSource = readSource("backend/app.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const serverSource = readSource("backend/server.ts");

    expect(getJoseRuntimeImportBoundaryStatus()).toEqual({
      jwtVerifyImported: true,
      createRemoteJWKSetImported: true,
      realVerificationEnabled: false,
    });

    expect(configSource).toContain("readJwtVerificationConfiguration");
    expect(configSource).toContain("isJwtVerificationConfigured");
    expect(configSource).toContain("FREE_AI_MIXER_AUTH_JWKS_URI");
    expect(configSource).toContain("remote_jwks");

    // Phase 122 is audit-only. Config exists but is not wired into JWT execution yet.
    expect(jwtSource).not.toContain("readJwtVerificationConfiguration");
    expect(jwtSource).not.toContain("isJwtVerificationConfigured");
    expect(jwtSource).toContain("realVerificationEnabled: false");
    expect(jwtSource).not.toContain("await jwtVerify");
    expect(jwtSource).not.toContain("jwtVerify(");
    expect(jwtSource).not.toContain("createRemoteJWKSet(");
    expect(jwtSource).not.toContain("new URL(");

    expect(compositionSource).not.toContain("readJwtVerificationConfiguration");
    expect(middlewareSource).not.toContain("readJwtVerificationConfiguration");
    expect(appSource).not.toContain("readJwtVerificationConfiguration");
    expect(routeSource).not.toContain("readJwtVerificationConfiguration");
    expect(serverSource).not.toContain("readJwtVerificationConfiguration");

    expect(routeSource).toContain("getRequesterContextFromRequest");
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("jwt config wiring audit keeps fake auth frontend storage and artifact delivery blocked", async () => {
    const routeSource = readSource("backend/routes/exports.ts");

    const authSource =
      readSource("backend/auth/jwtVerificationConfiguration.ts") +
      "\n" +
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
