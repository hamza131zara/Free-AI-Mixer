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

test.describe("phase108 route authorization enforcement readiness final audit pack", () => {
  test("auth runtime app composition exists but route authorization enforcement is still deferred", async () => {
    const appSource = readSource("backend/app.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const configSource = readSource("backend/auth/trustedAuthProviderRuntimeConfig.ts");
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");

    expect(appSource).toContain("createTrustedAuthMiddleware");
    expect(appSource).toContain("readTrustedAuthProviderRuntimeConfig");
    expect(appSource).toContain("runtimeConfig: readTrustedAuthProviderRuntimeConfig()");

    expect(middlewareSource).toContain("createTrustedAuthMiddleware");
    expect(middlewareSource).toContain("runtimeConfig");
    expect(configSource).toContain("readTrustedAuthProviderRuntimeConfig");
    expect(compositionSource).toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");

    expect(routeSource).toContain("getRequesterContextFromRequest");

    // Final readiness audit only: routes still must not enforce authorization.
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("all route authorization boundaries exist but remain unwired from export routes", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const requesterContextSource = readSource("backend/auth/requesterContext.ts");
    const requesterResolverSource = readSource("backend/auth/requesterContextResolver.ts");
    const adapterSource = readSource("backend/auth/exportRequesterContextAdapter.ts");
    const authorizationSource = readSource("backend/auth/exportAuthorization.ts");
    const routeGuardSource = readSource("backend/auth/exportAuthorizationRouteGuard.ts");

    expect(requesterContextSource).toContain("BackendRequesterContext");
    expect(requesterResolverSource).toContain("resolveRequesterContext");
    expect(adapterSource).toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(adapterSource).toContain("missing_workspace");

    expect(authorizationSource).toContain("decideExportOwnerScopeAccess");
    expect(authorizationSource).toContain("local_dev_fallback_not_production_auth");
    expect(authorizationSource).toContain("owner_mismatch");
    expect(authorizationSource).toContain("workspace_mismatch");

    expect(routeGuardSource).toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeGuardSource).toContain("statusCode: 401");
    expect(routeGuardSource).toContain("statusCode: 403");

    // Boundaries exist, but route wiring remains deferred.
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");

    // No trusted-header shortcut.
    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("x-user-id");
    expect(routeSource).not.toContain("x-workspace-id");
  });

  test("final readiness audit keeps real auth rls workspace membership and artifact delivery deferred", async () => {
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

    const docsSource =
      readIfExists("docs/known-issues.md") + "\n" + readIfExists("docs/phases.md");

    expect(routeSource).not.toContain("workspace membership");
    expect(routeSource).not.toContain("membershipRepository");
    expect(routeSource).not.toContain("isWorkspaceMember");
    expect(routeSource).not.toContain("applyRls");

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
