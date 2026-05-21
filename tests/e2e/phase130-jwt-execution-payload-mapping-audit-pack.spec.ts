import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createFailClosedFutureJwtVerificationStrategy,
  executeJwtVerificationWithJose,
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

test.describe("phase130 jwt execution and payload mapping audit pack", () => {
  test("jwt execution helper exists but defaults to fail-closed non-execution", async () => {
    const configured = readJwtVerificationConfiguration({
      FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
      FREE_AI_MIXER_AUTH_ISSUER: "https://auth.example.test",
      FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
      FREE_AI_MIXER_AUTH_JWKS_URI: "https://auth.example.test/.well-known/jwks.json",
    });

    expect(getJoseRuntimeImportBoundaryStatus()).toEqual({
      jwtVerifyImported: true,
      createRemoteJWKSetImported: true,
      realVerificationEnabled: false,
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
  });

  test("verified payload mapping shape exists but is not wired into strategy routes app or server", async () => {
    const jwtSource = readSource("backend/auth/jwtProviderVerificationStrategy.ts");
    const requesterSource = readSource("backend/auth/requesterContext.ts");
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const appSource = readSource("backend/app.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const serverSource = readSource("backend/server.ts");

    expect(jwtSource).toContain("executeJwtVerificationWithJose");
    expect(jwtSource).toContain("await jwtVerify");
    expect(jwtSource).toContain("verified.payload.sub");
    expect(jwtSource).toContain("verified.payload.workspaceId");
    expect(jwtSource).toContain("verified.payload.workspace_id");
    expect(jwtSource).toContain('authProvider: "jwt"');
    expect(jwtSource).toContain("authSubject: subject");

    expect(requesterSource).toContain("BackendRequesterContext");

    // Phase 130 is audit-only. The fail-closed strategy still does not call execution helper.
    expect(jwtSource).toContain("void constructRemoteJwksForJwtVerification(options.verificationConfig)");
    expect(jwtSource).not.toContain("return executeJwtVerificationWithJose");
    expect(jwtSource).not.toContain("await executeJwtVerificationWithJose");

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

    expect(nonJwtBoundaryRuntimeSource).not.toContain("executeJwtVerificationWithJose");
    expect(nonJwtBoundaryRuntimeSource).not.toContain("await jwtVerify");
    expect(nonJwtBoundaryRuntimeSource).not.toContain('from "jose"');

    expect(routeSource).toContain("getRequesterContextFromRequest");
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("jwt execution audit keeps route enforcement frontend storage and artifact delivery blocked", async () => {
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

    const configured = readJwtVerificationConfiguration({
      FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
      FREE_AI_MIXER_AUTH_ISSUER: "https://auth.example.test",
      FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
      FREE_AI_MIXER_AUTH_JWKS_URI: "https://auth.example.test/.well-known/jwks.json",
    });

    const strategy = createFailClosedFutureJwtVerificationStrategy({
      verificationConfig: configured,
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
