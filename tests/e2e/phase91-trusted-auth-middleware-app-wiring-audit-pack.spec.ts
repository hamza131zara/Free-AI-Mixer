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

test.describe("phase91 trusted auth middleware app wiring audit pack", () => {
  test("trusted auth middleware boundary exists and app wiring is now non-enforcing", async () => {
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const appSource = readSource("backend/app.ts");
    const serverSource = readSource("backend/server.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    expect(middlewareSource).toContain("createTrustedAuthNotConfiguredMiddleware");
    expect(middlewareSource).toContain("getRequesterContextFromRequest");
    expect(middlewareSource).toContain("auth_not_configured");

    expect(appSource).toContain("createTrustedAuthNotConfiguredMiddleware");

    // Phase 92 wires app middleware only. Server and routes remain non-enforcing.
    expect(serverSource).not.toContain("createTrustedAuthNotConfiguredMiddleware");
    expect(routeSource).not.toContain("createTrustedAuthNotConfiguredMiddleware");

    expect(routeSource).not.toContain("getRequesterContextFromRequest");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("app wiring readiness does not introduce fake auth trusted headers or secrets", async () => {
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const appSource = readSource("backend/app.ts");
    const serverSource = readSource("backend/server.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    const combinedSource =
      middlewareSource + "\n" + appSource + "\n" + serverSource + "\n" + routeSource;

    expect(combinedSource).not.toContain("fakeSession");
    expect(combinedSource).not.toContain("mockAuthenticatedUser");
    expect(combinedSource).not.toContain("localStorage");
    expect(combinedSource).not.toContain("service_role");
    expect(combinedSource).not.toContain("SERVICE_ROLE");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("x-user-id");
    expect(routeSource).not.toContain("x-workspace-id");

    expect(combinedSource).not.toContain("createSignedUrl");
    expect(combinedSource).not.toContain("getPublicUrl");
  });

  test("frontend and artifact delivery remain blocked until real app auth wiring exists", async () => {
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
