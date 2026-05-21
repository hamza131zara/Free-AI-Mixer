import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase105 auth runtime config app composition audit pack", () => {
  test("app composition still uses auth-not-configured wrapper and not runtime auth config", async () => {
    const appSource = readSource("backend/app.ts");
    const serverSource = readSource("backend/server.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const configSource = readSource("backend/auth/trustedAuthProviderRuntimeConfig.ts");
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");

    expect(middlewareSource).toContain("readTrustedAuthProviderRuntimeConfig");
    expect(middlewareSource).toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");
    expect(configSource).toContain("readTrustedAuthProviderRuntimeConfig");
    expect(compositionSource).toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");

    // App composition remains safe and non-enforcing.
    expect(appSource).toContain("createTrustedAuthNotConfiguredMiddleware");
    expect(appSource).toContain("app.use(createTrustedAuthNotConfiguredMiddleware())");

    // Runtime config is not wired into app/server composition yet.
    expect(appSource).not.toContain("readTrustedAuthProviderRuntimeConfig");
    expect(appSource).not.toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");
    expect(appSource).not.toContain("createTrustedAuthMiddleware({");
    expect(appSource).not.toContain("FREE_AI_MIXER_AUTH_PROVIDER");
    expect(appSource).not.toContain("future_jwt_provider");
    expect(appSource).not.toContain("future_session_provider");

    expect(serverSource).not.toContain("readTrustedAuthProviderRuntimeConfig");
    expect(serverSource).not.toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");
    expect(serverSource).not.toContain("createTrustedAuthMiddleware({");
    expect(serverSource).not.toContain("FREE_AI_MIXER_AUTH_PROVIDER");
    expect(serverSource).not.toContain("future_jwt_provider");
    expect(serverSource).not.toContain("future_session_provider");
  });

  test("export routes still read trusted context non-enforcing and do not authorize yet", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const adapterSource = readSource("backend/auth/exportRequesterContextAdapter.ts");
    const authorizationSource = readSource("backend/auth/exportAuthorization.ts");
    const routeGuardSource = readSource("backend/auth/exportAuthorizationRouteGuard.ts");

    expect(routeSource).toContain("getRequesterContextFromRequest");
    expect(adapterSource).toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(authorizationSource).toContain("decideExportOwnerScopeAccess");
    expect(routeGuardSource).toContain("mapExportAuthorizationDecisionToRouteGuard");

    // Route authorization remains deferred.
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");

    // No trusted-header shortcut.
    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("x-user-id");
    expect(routeSource).not.toContain("x-workspace-id");
  });

  test("app composition audit does not introduce fake auth frontend storage or artifact delivery", async () => {
    const authSource =
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
