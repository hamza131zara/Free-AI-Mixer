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

test.describe("phase87 export authorization route enforcement audit pack", () => {
  test("authorization decision and route guard boundaries exist but remain unwired from routes", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const authorizationSource = readSource("backend/auth/exportAuthorization.ts");
    const routeGuardSource = readSource("backend/auth/exportAuthorizationRouteGuard.ts");
    const requesterSource = readSource("backend/requester/exportRequesterContext.ts");

    expect(authorizationSource).toContain("decideExportOwnerScopeAccess");
    expect(routeGuardSource).toContain("mapExportAuthorizationDecisionToRouteGuard");

    expect(requesterSource).toContain("local_dev_fallback");
    expect(requesterSource).toContain("authenticated_session");
    expect(requesterSource).toContain("authenticated_token");

    // Phase 87 is audit-only. Enforcement remains deferred.
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("trusted auth middleware and rls remain required before route enforcement", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const requesterSource = readSource("backend/requester/exportRequesterContext.ts");
    const authResolverSource = readSource("backend/auth/requesterContextResolver.ts");
    const docsSource =
      readIfExists("docs/known-issues.md") + "\n" + readIfExists("docs/phases.md");

    expect(routeSource).toContain("requesterContextResolver");
    expect(routeSource).toContain("resolveExportRequesterContext");

    expect(requesterSource).toContain("createLocalDevFallbackExportRequesterContext");
    expect(authResolverSource).toContain("auth_not_configured");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("x-user-id");
    expect(routeSource).not.toContain("x-workspace-id");
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("service_role");
    expect(routeSource).not.toContain("SERVICE_ROLE");

    expect(docsSource).toContain("auth");
    expect(docsSource).toContain("RLS");
    expect(docsSource).toContain("ownership");
  });

  test("artifact delivery and frontend storage access remain blocked while enforcement is deferred", async () => {
    const frontendSource =
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/types/exportJob.ts") +
      "\n" +
      readIfExists("src/services/exportHandleStorage.ts");

    const artifactProviderSource =
      readIfExists("backend/artifacts/artifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/localDevArtifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/notConfiguredArtifactAccessProvider.ts");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");

    expect(artifactProviderSource).not.toContain("production_ready_local_dev_stream");
    expect(artifactProviderSource).not.toContain("createSignedUrl");
    expect(artifactProviderSource).not.toContain("getPublicUrl");
  });
});
