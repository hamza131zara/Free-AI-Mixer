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

test.describe("phase93 export routes trusted request context consumption audit pack", () => {
  test("app has non-enforcing trusted auth middleware and export routes now read context non-enforcing", async () => {
    const appSource = readSource("backend/app.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const requesterSource = readSource("backend/requester/exportRequesterContext.ts");

    expect(appSource).toContain("createTrustedAuthNotConfiguredMiddleware");
    expect(middlewareSource).toContain("getRequesterContextFromRequest");
    expect(middlewareSource).toContain("backendRequesterContext");
    expect(middlewareSource).toContain("auth_not_configured");

    expect(routeSource).toContain("requesterContextResolver");
    expect(routeSource).toContain("resolveExportRequesterContext");
    expect(requesterSource).toContain("resolveExportRequesterContext");

    // Phase 94 may read trusted request context, but it remains non-enforcing.
    expect(routeSource).toContain("getRequesterContextFromRequest");
    expect(routeSource).not.toContain("backendRequesterContext");
    expect(routeSource).not.toContain("createTrustedAuthNotConfiguredMiddleware");

    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("future route consumption path has boundaries but authorization remains unwired", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const adapterSource = readSource("backend/auth/exportRequesterContextAdapter.ts");
    const authorizationSource = readSource("backend/auth/exportAuthorization.ts");
    const routeGuardSource = readSource("backend/auth/exportAuthorizationRouteGuard.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");

    expect(middlewareSource).toContain("getRequesterContextFromRequest");
    expect(adapterSource).toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(authorizationSource).toContain("decideExportOwnerScopeAccess");
    expect(routeGuardSource).toContain("mapExportAuthorizationDecisionToRouteGuard");

    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");

    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("service_role");
    expect(routeSource).not.toContain("SERVICE_ROLE");
    expect(routeSource).not.toContain("createSignedUrl");
    expect(routeSource).not.toContain("getPublicUrl");
  });

  test("frontend and artifact delivery remain blocked until trusted route authorization exists", async () => {
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
