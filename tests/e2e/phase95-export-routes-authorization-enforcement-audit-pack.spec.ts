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

test.describe("phase95 export routes authorization enforcement audit pack", () => {
  test("routes read trusted context but authorization enforcement remains deferred", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const appSource = readSource("backend/app.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const adapterSource = readSource("backend/auth/exportRequesterContextAdapter.ts");
    const authorizationSource = readSource("backend/auth/exportAuthorization.ts");
    const routeGuardSource = readSource("backend/auth/exportAuthorizationRouteGuard.ts");

    expect(appSource).toContain("createTrustedAuthNotConfiguredMiddleware");
    expect(routeSource).toContain("getRequesterContextFromRequest");
    expect(middlewareSource).toContain("auth_not_configured");

    expect(adapterSource).toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(authorizationSource).toContain("decideExportOwnerScopeAccess");
    expect(routeGuardSource).toContain("mapExportAuthorizationDecisionToRouteGuard");

    // Phase 95 is audit/readiness only. Routes read context but do not enforce yet.
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("enforcement remains blocked because trusted auth provider and workspace membership are not implemented", async () => {
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const requesterResolverSource = readSource("backend/auth/requesterContextResolver.ts");
    const adapterSource = readSource("backend/auth/exportRequesterContextAdapter.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const docsSource =
      readIfExists("docs/known-issues.md") + "\n" + readIfExists("docs/phases.md");

    expect(middlewareSource).toContain("auth_not_configured");
    expect(requesterResolverSource).toContain("auth_not_configured");
    expect(adapterSource).toContain("missing_workspace");

    expect(routeSource).not.toContain("workspace membership");
    expect(routeSource).not.toContain("membershipRepository");
    expect(routeSource).not.toContain("isWorkspaceMember");
    expect(routeSource).not.toContain("applyRls");
    expect(routeSource).not.toContain("rls");

    expect(docsSource).toContain("trusted auth");
    expect(docsSource).toContain("RLS");
    expect(docsSource).toContain("ownership");
  });

  test("no fake auth trusted-header shortcut or public artifact delivery is introduced", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const authTreeSource =
      readSource("backend/auth/requesterContext.ts") +
      "\n" +
      readSource("backend/auth/requesterContextResolver.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthMiddleware.ts") +
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

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("x-user-id");
    expect(routeSource).not.toContain("x-workspace-id");

    expect(authTreeSource).not.toContain("fakeSession");
    expect(authTreeSource).not.toContain("mockAuthenticatedUser");
    expect(authTreeSource).not.toContain("service_role");
    expect(authTreeSource).not.toContain("SERVICE_ROLE");

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
