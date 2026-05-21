import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createFailClosedFutureJwtVerificationStrategy,
  getJoseRuntimeImportBoundaryStatus,
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

test.describe("phase119 jwt verification runtime import boundary pack", () => {
  test("jose runtime import boundary exists but real verification stays disabled", async () => {
    expect(getJoseRuntimeImportBoundaryStatus()).toEqual({
      jwtVerifyImported: true,
      createRemoteJWKSetImported: true,
      realVerificationEnabled: false,
    });

    const futureJwt = createFailClosedFutureJwtVerificationStrategy();

    await expect(futureJwt.verify()).resolves.toEqual({
      kind: "not_verified",
      reason: "missing_credentials",
    });

    await expect(
      futureJwt.verify({
        headers: {
          authorization: "Bearer fake-token-must-not-authenticate",
        },
      }),
    ).resolves.toEqual({
      kind: "not_verified",
      reason: "invalid_credentials",
    });
  });

  test("jwt provider composition still fails closed with jose import boundary present", async () => {
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
  });

  test("jose import remains isolated to jwt boundary and routes/artifacts stay blocked", async () => {
    const jwtSource = readSource("backend/auth/jwtProviderVerificationStrategy.ts");
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const appSource = readSource("backend/app.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    expect(jwtSource).toContain('from "jose"');
    expect(jwtSource).toContain("jwtVerify");
    expect(jwtSource).toContain("createRemoteJWKSet");
    expect(jwtSource).toContain("realVerificationEnabled: false");

    const nonJwtBoundaryRuntimeSource = compositionSource + "\n" + middlewareSource + "\n" + appSource + "\n" + routeSource;

    expect(nonJwtBoundaryRuntimeSource).not.toContain('from "jose"');
    expect(nonJwtBoundaryRuntimeSource).not.toContain("jwtVerify");
    expect(nonJwtBoundaryRuntimeSource).not.toContain("createRemoteJWKSet");

    expect(routeSource).toContain("getRequesterContextFromRequest");
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");

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
