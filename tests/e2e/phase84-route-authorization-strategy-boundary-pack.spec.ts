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

test.describe("phase84 route authorization strategy boundary pack", () => {
  test("export ownership contracts exist while route auth enforcement remains deferred", async () => {
    const exportContractsSource = readSource("backend/contracts/exportHttpTypes.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const requesterSource = readSource("backend/requester/exportRequesterContext.ts");
    const authContextSource = readSource("backend/auth/requesterContext.ts");
    const authResolverSource = readSource("backend/auth/requesterContextResolver.ts");

    expect(exportContractsSource).toContain("ownerId");
    expect(exportContractsSource).toContain("workspaceId");

    expect(routeSource).toContain("requesterContextResolver");
    expect(routeSource).toContain("resolveExportRequesterContext");

    expect(requesterSource).toContain("resolveExportRequesterContext");
    expect(authContextSource).toContain("BackendRequesterContext");
    expect(authResolverSource).toContain("auth_not_configured");

    // Phase 84 is strategy only: no route authorization enforcement yet.
    expect(routeSource).not.toContain("isAuthenticatedRequesterContext");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
    expect(routeSource).not.toContain("workspace membership");
    expect(routeSource).not.toContain("membership");
  });

  test("future route authorization must use trusted requester context not arbitrary headers", async () => {
    const requesterSource = readSource("backend/requester/exportRequesterContext.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    expect(requesterSource).toContain("local_dev_fallback");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("x-user-id");
    expect(routeSource).not.toContain("x-workspace-id");
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("localStorage");
    expect(routeSource).not.toContain("service_role");
    expect(routeSource).not.toContain("SERVICE_ROLE");
  });

  test("frontend and artifact delivery remain blocked from public authorization bypasses", async () => {
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
      readIfExists("backend/artifacts/localDevArtifactAccessProvider.ts");

    const docsSource =
      readIfExists("docs/known-issues.md") + "\n" + readIfExists("docs/phases.md");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");

    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("getPublicUrl");
    expect(artifactSource).not.toContain("production_ready_local_dev_stream");

    expect(docsSource).toContain("auth");
    expect(docsSource).toContain("RLS");
    expect(docsSource).toContain("ownership");
  });
});

