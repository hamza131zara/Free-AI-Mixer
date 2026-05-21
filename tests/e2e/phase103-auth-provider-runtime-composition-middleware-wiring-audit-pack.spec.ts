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

test.describe("phase103 auth provider runtime composition middleware wiring audit pack", () => {
  test("trusted auth middleware remains provider-strategy based and does not consume runtime composition yet", async () => {
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");
    const configSource = readSource("backend/auth/trustedAuthProviderRuntimeConfig.ts");
    const providerSource = readSource("backend/auth/trustedAuthProviderStrategy.ts");

    expect(middlewareSource).toContain("createTrustedAuthMiddleware");
    expect(middlewareSource).toContain("TrustedAuthProviderStrategy");
    expect(middlewareSource).toContain("providerStrategy");
    expect(middlewareSource).toContain("createAuthNotConfiguredTrustedAuthProviderStrategy");

    expect(compositionSource).toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");
    expect(configSource).toContain("readTrustedAuthProviderRuntimeConfig");
    expect(providerSource).toContain("TrustedAuthProviderStrategy");

    // Phase 103 is audit/readiness only. Middleware runtime composition wiring remains deferred.
    expect(middlewareSource).not.toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");
    expect(middlewareSource).not.toContain("readTrustedAuthProviderRuntimeConfig");
    expect(middlewareSource).not.toContain("isTrustedAuthProviderRuntimeConfigured");
    expect(middlewareSource).not.toContain("future_jwt_provider");
    expect(middlewareSource).not.toContain("future_session_provider");
  });

  test("app server and routes still do not wire runtime composition provider behavior", async () => {
    const appSource = readSource("backend/app.ts");
    const serverSource = readSource("backend/server.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    expect(appSource).toContain("createTrustedAuthNotConfiguredMiddleware");
    expect(routeSource).toContain("getRequesterContextFromRequest");

    expect(appSource).not.toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");
    expect(serverSource).not.toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");
    expect(routeSource).not.toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");

    expect(appSource).not.toContain("readTrustedAuthProviderRuntimeConfig");
    expect(serverSource).not.toContain("readTrustedAuthProviderRuntimeConfig");
    expect(routeSource).not.toContain("readTrustedAuthProviderRuntimeConfig");

    // Route authorization remains deferred.
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("middleware composition audit does not introduce fake auth secrets frontend storage or artifact delivery", async () => {
    const authSource =
      readSource("backend/auth/trustedAuthMiddleware.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderComposition.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderRuntimeConfig.ts") +
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
