import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createFailClosedFutureJwtVerificationStrategy,
  executeJwtVerificationWithJose,
  mapJwtVerificationResultToRequesterContext,
  mapVerifiedJwtPayloadToVerificationResult,
} from "../../backend/auth/jwtProviderVerificationStrategy";
import { readJwtVerificationConfiguration } from "../../backend/auth/jwtVerificationConfiguration";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase131 jwt execution and production requester mapping pack", () => {
  test("verified jwt payload maps to authenticated requester context shape", async () => {
    const camelCaseResult = mapVerifiedJwtPayloadToVerificationResult({
      sub: "user-123",
      workspaceId: "workspace-456",
    });

    expect(camelCaseResult).toEqual({
      kind: "verified",
      userId: "user-123",
      workspaceId: "workspace-456",
      authProvider: "jwt",
      authSubject: "user-123",
    });

    expect(mapJwtVerificationResultToRequesterContext(camelCaseResult)).toEqual({
      kind: "authenticated",
      userId: "user-123",
      workspaceId: "workspace-456",
      authProvider: "jwt",
      authSubject: "user-123",
    });

    const snakeCaseResult = mapVerifiedJwtPayloadToVerificationResult({
      sub: "user-abc",
      workspace_id: "workspace-def",
    });

    expect(snakeCaseResult).toEqual({
      kind: "verified",
      userId: "user-abc",
      workspaceId: "workspace-def",
      authProvider: "jwt",
      authSubject: "user-abc",
    });

    expect(mapVerifiedJwtPayloadToVerificationResult({ workspaceId: "workspace-only" })).toEqual({
      kind: "not_verified",
      reason: "invalid_credentials",
    });

    expect(mapVerifiedJwtPayloadToVerificationResult({ sub: "user-only" })).toEqual({
      kind: "not_verified",
      reason: "invalid_credentials",
    });
  });

  test("jwt strategy calls execution helper while real execution remains disabled by default", async () => {
    const configured = readJwtVerificationConfiguration({
      FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
      FREE_AI_MIXER_AUTH_ISSUER: "https://auth.example.test",
      FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
      FREE_AI_MIXER_AUTH_JWKS_URI: "https://auth.example.test/.well-known/jwks.json",
    });

    await expect(
      executeJwtVerificationWithJose(
        {
          headers: {},
        },
        configured,
      ),
    ).resolves.toEqual({
      kind: "not_verified",
      reason: "missing_credentials",
    });

    await expect(
      executeJwtVerificationWithJose(
        {
          headers: {
            authorization: "Bearer fake-token-must-not-authenticate",
          },
        },
        configured,
      ),
    ).resolves.toEqual({
      kind: "not_verified",
      reason: "invalid_credentials",
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
  });

  test("production mapping is not route-enforced and artifact delivery remains blocked", async () => {
    const jwtSource = readSource("backend/auth/jwtProviderVerificationStrategy.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const appSource = readSource("backend/app.ts");
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");

    expect(jwtSource).toContain("mapVerifiedJwtPayloadToVerificationResult");
    expect(jwtSource).toContain("executeJwtVerificationWithJose");
    expect(jwtSource).toContain("executeRealVerification: options.executeRealVerification === true");
    expect(jwtSource).toContain("return mapVerifiedJwtPayloadToVerificationResult");

    expect(compositionSource).toContain("mapJwtVerificationResultToRequesterContext");
    expect(appSource).toContain("createTrustedAuthMiddleware");

    expect(routeSource).toContain("getRequesterContextFromRequest");
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');

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

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");

    expect(artifactSource).not.toContain("production_ready_local_dev_stream");
    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("getPublicUrl");
  });
});
