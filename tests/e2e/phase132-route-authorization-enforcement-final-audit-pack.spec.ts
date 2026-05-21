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

test.describe("phase132 route authorization enforcement final audit pack", () => {
  test("auth and authorization boundaries exist before route enforcement", async () => {
    const jwtSource = readSource("backend/auth/jwtProviderVerificationStrategy.ts");
    const requesterSource = readSource("backend/auth/requesterContext.ts");
    const requesterResolverSource = readSource("backend/auth/requesterContextResolver.ts");
    const adapterSource = readSource("backend/auth/exportRequesterContextAdapter.ts");
    const authorizationSource = readSource("backend/auth/exportAuthorization.ts");
    const guardSource = readSource("backend/auth/exportAuthorizationRouteGuard.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const appSource = readSource("backend/app.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    expect(jwtSource).toContain("mapVerifiedJwtPayloadToVerificationResult");
    expect(jwtSource).toContain("mapJwtVerificationResultToRequesterContext");
    expect(jwtSource).toContain("executeJwtVerificationWithJose");

    expect(requesterSource).toContain("BackendRequesterContext");
    expect(requesterResolverSource).toContain("resolveRequesterContext");

    expect(adapterSource).toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(authorizationSource).toContain("decideExportOwnerScopeAccess");
    expect(guardSource).toContain("mapExportAuthorizationDecisionToRouteGuard");

    expect(middlewareSource).toContain("createTrustedAuthMiddleware");
    expect(appSource).toContain("createTrustedAuthMiddleware");
    expect(routeSource).toContain("getRequesterContextFromRequest");
  });

  test("export routes still do not enforce authorization or emit auth errors", async () => {
    const routeSource = readSource("backend/routes/exports.ts");

    // Final audit only: route authorization enforcement remains deferred.
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");

    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
    expect(routeSource).not.toContain("statusCode: 401");
    expect(routeSource).not.toContain("statusCode: 403");

    // No trusted-header shortcut.
    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("x-user-id");
    expect(routeSource).not.toContain("x-workspace-id");
  });

  test("route enforcement audit keeps workspace rls frontend storage and artifact delivery deferred", async () => {
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

    expect(routeSource).not.toContain("membershipRepository");
    expect(routeSource).not.toContain("isWorkspaceMember");
    expect(routeSource).not.toContain("applyRls");

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
