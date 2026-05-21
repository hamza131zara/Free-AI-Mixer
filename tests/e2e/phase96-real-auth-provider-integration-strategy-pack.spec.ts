import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createAuthNotConfiguredTrustedAuthProviderStrategy,
  resolveTrustedAuthProviderRequesterContext,
} from "../../backend/auth/trustedAuthProviderStrategy";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase96 real auth provider integration strategy pack", () => {
  test("auth provider strategy boundary exists and remains auth-not-configured by default", async () => {
    const strategy = createAuthNotConfiguredTrustedAuthProviderStrategy();

    expect(strategy.kind).toBe("auth_not_configured_provider");

    await expect(
      resolveTrustedAuthProviderRequesterContext(strategy, {
        headers: {
          authorization: "Bearer fake-token-must-not-authenticate",
          "x-user-id": "fake-user-must-not-authenticate",
          "x-workspace-id": "fake-workspace-must-not-authenticate",
        },
      }),
    ).resolves.toEqual({
      kind: "unauthenticated",
      reason: "auth_not_configured",
    });
  });

  test("strategy boundary can be used by middleware but route enforcement remains deferred", async () => {
    const providerSource = readSource("backend/auth/trustedAuthProviderStrategy.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const appSource = readSource("backend/app.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const serverSource = readSource("backend/server.ts");

    expect(providerSource).toContain("TrustedAuthProviderStrategy");
    expect(providerSource).toContain("createAuthNotConfiguredTrustedAuthProviderStrategy");
    expect(providerSource).toContain("resolveTrustedAuthProviderRequesterContext");
    expect(providerSource).toContain("future_jwt_provider");
    expect(providerSource).toContain("future_session_provider");
    expect(providerSource).toContain("auth_not_configured");

    // Phase 97 may wire provider strategy into middleware only.
    expect(middlewareSource).toContain("TrustedAuthProviderStrategy");
    expect(middlewareSource).toContain("createTrustedAuthMiddleware");

    // App still uses the auth-not-configured middleware wrapper.
    expect(appSource).toContain("createTrustedAuthNotConfiguredMiddleware");

    // Routes/server do not wire a real provider or enforce auth yet.
    expect(routeSource).not.toContain("createAuthNotConfiguredTrustedAuthProviderStrategy");
    expect(serverSource).not.toContain("createAuthNotConfiguredTrustedAuthProviderStrategy");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");

    expect(providerSource).not.toContain("fakeSession");
    expect(providerSource).not.toContain("mockAuthenticatedUser");
    expect(providerSource).not.toContain("service_role");
    expect(providerSource).not.toContain("SERVICE_ROLE");
    expect(providerSource).not.toContain("createSignedUrl");
    expect(providerSource).not.toContain("getPublicUrl");
  });

  test("frontend and artifact delivery remain blocked until real auth provider exists", async () => {
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
