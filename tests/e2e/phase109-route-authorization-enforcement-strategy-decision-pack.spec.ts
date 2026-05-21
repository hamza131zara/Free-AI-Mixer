import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createTrustedAuthProviderStrategyFromRuntimeConfig } from "../../backend/auth/trustedAuthProviderComposition";
import { readTrustedAuthProviderRuntimeConfig } from "../../backend/auth/trustedAuthProviderRuntimeConfig";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase109 route authorization enforcement strategy decision pack", () => {
  test("strategy decision keeps route enforcement blocked while auth providers fail closed", async () => {
    const jwtConfig = readTrustedAuthProviderRuntimeConfig({
      FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
      FREE_AI_MIXER_AUTH_ISSUER: "https://auth.example.test",
      FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
    });

    const jwtStrategy = createTrustedAuthProviderStrategyFromRuntimeConfig(jwtConfig);

    expect(jwtStrategy.kind).toBe("future_jwt_provider");

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

    const sessionConfig = readTrustedAuthProviderRuntimeConfig({
      FREE_AI_MIXER_AUTH_PROVIDER: "session",
    });

    const sessionStrategy =
      createTrustedAuthProviderStrategyFromRuntimeConfig(sessionConfig);

    expect(sessionStrategy.kind).toBe("future_session_provider");

    await expect(sessionStrategy.resolveRequesterContext()).resolves.toEqual({
      kind: "unauthenticated",
      reason: "invalid_credentials",
    });
  });

  test("all enforcement boundaries exist but export routes still do not enforce authorization", async () => {
    const appSource = readSource("backend/app.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const configSource = readSource("backend/auth/trustedAuthProviderRuntimeConfig.ts");
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");
    const adapterSource = readSource("backend/auth/exportRequesterContextAdapter.ts");
    const authorizationSource = readSource("backend/auth/exportAuthorization.ts");
    const routeGuardSource = readSource("backend/auth/exportAuthorizationRouteGuard.ts");

    expect(appSource).toContain("createTrustedAuthMiddleware");
    expect(appSource).toContain("readTrustedAuthProviderRuntimeConfig");
    expect(appSource).toContain("runtimeConfig: readTrustedAuthProviderRuntimeConfig()");

    expect(middlewareSource).toContain("createTrustedAuthMiddleware");
    expect(configSource).toContain("readTrustedAuthProviderRuntimeConfig");
    expect(compositionSource).toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");

    expect(routeSource).toContain("getRequesterContextFromRequest");

    expect(adapterSource).toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(authorizationSource).toContain("decideExportOwnerScopeAccess");
    expect(routeGuardSource).toContain("mapExportAuthorizationDecisionToRouteGuard");

    // Phase 109 decision: do not enforce routes yet.
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("decision keeps workspace membership rls frontend storage and artifact delivery deferred", async () => {
    const routeSource = readSource("backend/routes/exports.ts");

    const authSource =
      readSource("backend/app.ts") +
      "\n" +
      readSource("backend/routes/exports.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthMiddleware.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderRuntimeConfig.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderComposition.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderStrategy.ts") +
      "\n" +
      readSource("backend/auth/exportRequesterContextAdapter.ts") +
      "\n" +
      readSource("backend/auth/exportAuthorization.ts") +
      "\n" +
      readSource("backend/auth/exportAuthorizationRouteGuard.ts");

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

    const docsSource =
      readIfExists("docs/known-issues.md") + "\n" + readIfExists("docs/phases.md");

    expect(routeSource).not.toContain("workspace membership");
    expect(routeSource).not.toContain("membershipRepository");
    expect(routeSource).not.toContain("isWorkspaceMember");
    expect(routeSource).not.toContain("applyRls");

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

    expect(docsSource).toContain("auth");
    expect(docsSource).toContain("RLS");
    expect(docsSource).toContain("ownership");
  });
});
