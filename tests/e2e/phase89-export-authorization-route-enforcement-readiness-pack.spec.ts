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

test.describe("phase89 export authorization route enforcement readiness pack", () => {
  test("all authorization boundaries exist while route enforcement remains deferred", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const requesterResolverSource = readSource("backend/auth/requesterContextResolver.ts");
    const adapterSource = readSource("backend/auth/exportRequesterContextAdapter.ts");
    const authorizationSource = readSource("backend/auth/exportAuthorization.ts");
    const routeGuardSource = readSource("backend/auth/exportAuthorizationRouteGuard.ts");
    const requesterSource = readSource("backend/requester/exportRequesterContext.ts");

    expect(routeSource).toContain("requesterContextResolver");
    expect(routeSource).toContain("resolveExportRequesterContext");

    expect(requesterResolverSource).toContain("resolveRequesterContext");
    expect(requesterResolverSource).toContain("auth_not_configured");

    expect(adapterSource).toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(adapterSource).toContain("toExportOwnerScopeFromAuthenticatedRequester");
    expect(adapterSource).toContain("missing_workspace");

    expect(authorizationSource).toContain("decideExportOwnerScopeAccess");
    expect(authorizationSource).toContain("local_dev_fallback_not_production_auth");
    expect(authorizationSource).toContain("owner_mismatch");
    expect(authorizationSource).toContain("workspace_mismatch");

    expect(routeGuardSource).toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeGuardSource).toContain("statusCode: 401");
    expect(routeGuardSource).toContain("statusCode: 403");

    expect(requesterSource).toContain("authenticated_session");
    expect(requesterSource).toContain("authenticated_token");

    // Phase 89 is readiness only. Route enforcement remains deferred.
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("readiness path does not trust headers or introduce fake auth", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const authTreeSource =
      readSource("backend/auth/requesterContext.ts") +
      "\n" +
      readSource("backend/auth/requesterContextResolver.ts") +
      "\n" +
      readSource("backend/auth/exportRequesterContextAdapter.ts") +
      "\n" +
      readSource("backend/auth/exportAuthorization.ts") +
      "\n" +
      readSource("backend/auth/exportAuthorizationRouteGuard.ts");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("x-user-id");
    expect(routeSource).not.toContain("x-workspace-id");

    expect(authTreeSource).not.toContain("fakeSession");
    expect(authTreeSource).not.toContain("mockAuthenticatedUser");
    expect(authTreeSource).not.toContain("localStorage");
    expect(authTreeSource).not.toContain("service_role");
    expect(authTreeSource).not.toContain("SERVICE_ROLE");
    expect(authTreeSource).not.toContain("createSignedUrl");
    expect(authTreeSource).not.toContain("getPublicUrl");
  });

  test("frontend and artifact delivery remain blocked until real enforcement exists", async () => {
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
