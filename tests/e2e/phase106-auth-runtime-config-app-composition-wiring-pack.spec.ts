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

test.describe("phase106 auth runtime config app composition wiring pack", () => {
  test("app composes trusted auth middleware from runtime config fail-closed", async () => {
    const appSource = readSource("backend/app.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const configSource = readSource("backend/auth/trustedAuthProviderRuntimeConfig.ts");
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");

    expect(appSource).toContain("createTrustedAuthMiddleware");
    expect(appSource).toContain("readTrustedAuthProviderRuntimeConfig");
    expect(appSource).toContain("runtimeConfig: readTrustedAuthProviderRuntimeConfig()");
    expect(appSource).not.toContain("createTrustedAuthNotConfiguredMiddleware");

    expect(middlewareSource).toContain("createTrustedAuthMiddleware");
    expect(middlewareSource).toContain("runtimeConfig");
    expect(configSource).toContain("readTrustedAuthProviderRuntimeConfig");
    expect(compositionSource).toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");
    expect(compositionSource).toContain("invalid_credentials");
  });

  test("routes still read trusted context non-enforcing and do not authorize yet", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const serverSource = readSource("backend/server.ts");

    expect(routeSource).toContain("getRequesterContextFromRequest");

    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');

    expect(serverSource).not.toContain("createTrustedAuthMiddleware({");
    expect(serverSource).not.toContain("readTrustedAuthProviderRuntimeConfig");
  });

  test("runtime app composition does not introduce fake auth frontend storage or artifact delivery", async () => {
    const authSource =
      readSource("backend/app.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthMiddleware.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderRuntimeConfig.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderComposition.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderStrategy.ts");

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
  });
});
