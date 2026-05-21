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

test.describe("phase92 trusted auth middleware non enforcing app wiring pack", () => {
  test("app wires trusted auth middleware as non-enforcing auth-not-configured boundary", async () => {
    const appSource = readSource("backend/app.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const serverSource = readSource("backend/server.ts");

    expect(appSource).toContain("createTrustedAuthNotConfiguredMiddleware");
    expect(appSource).toContain("app.use(createTrustedAuthNotConfiguredMiddleware())");

    // App wires middleware, but route context reading belongs in routes after Phase 94.
    expect(appSource).not.toContain("getRequesterContextFromRequest");

    expect(middlewareSource).toContain("auth_not_configured");
    expect(middlewareSource).toContain("backendRequesterContext");
    expect(middlewareSource).toContain("getRequesterContextFromRequest");

    // Phase 94 may let routes read trusted context, but still no auth enforcement.
    expect(routeSource).toContain("getRequesterContextFromRequest");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");

    // Server startup remains unchanged.
    expect(serverSource).not.toContain("createTrustedAuthNotConfiguredMiddleware");
  });

  test("non-enforcing app auth wiring does not introduce fake auth or trusted header shortcuts", async () => {
    const appSource = readSource("backend/app.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    const combinedSource = appSource + "\n" + middlewareSource + "\n" + routeSource;

    expect(combinedSource).not.toContain("fakeSession");
    expect(combinedSource).not.toContain("mockAuthenticatedUser");
    expect(combinedSource).not.toContain("service_role");
    expect(combinedSource).not.toContain("SERVICE_ROLE");
    expect(combinedSource).not.toContain("createSignedUrl");
    expect(combinedSource).not.toContain("getPublicUrl");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("frontend and artifact delivery remain blocked after non-enforcing app wiring", async () => {
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
