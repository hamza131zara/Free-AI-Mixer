import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createAuthNotConfiguredRequesterContextResolver } from "../../backend/auth/requesterContextResolver";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase82 requester context route options boundary pack", () => {
  test("export router keeps existing non-enforcing requester context resolver option", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const exportRequesterContextSource = readSource("backend/requester/exportRequesterContext.ts");
    const authResolverSource = readSource("backend/auth/requesterContextResolver.ts");

    expect(routeSource).toContain("ExportRequesterContextResolver");
    expect(routeSource).toContain("requesterContextResolver?: ExportRequesterContextResolver");
    expect(routeSource).toContain("resolveExportRequesterContext");
    expect(routeSource).toContain("options?.requesterContextResolver ?? resolveExportRequesterContext");

    expect(exportRequesterContextSource).toContain("resolveExportRequesterContext");
    expect(authResolverSource).toContain("createAuthNotConfiguredRequesterContextResolver");
    expect(authResolverSource).toContain("auth_not_configured");

    // Phase 82 keeps route requester context as a non-enforcing boundary.
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("localStorage");
    expect(routeSource).not.toContain("service_role");
    expect(routeSource).not.toContain("SERVICE_ROLE");

    // Do not directly wire Phase 81 auth resolver into exports route yet.
    expect(routeSource).not.toContain("createAuthNotConfiguredRequesterContextResolver");
    expect(routeSource).not.toContain("BackendRequesterContextResolver");
  });

  test("default phase81 requester resolver remains unauthenticated and non-fabricating", async () => {
    const resolver = createAuthNotConfiguredRequesterContextResolver();

    expect(
      resolver.resolve({
        headers: {
          authorization: "Bearer fake-token",
          "x-user-id": "fake-user",
          "x-workspace-id": "fake-workspace",
        },
      }),
    ).toEqual({
      kind: "unauthenticated",
      reason: "auth_not_configured",
    });
  });

  test("frontend remains backend mediated and artifact delivery remains blocked", async () => {
    const frontendSource =
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/types/exportJob.ts") +
      "\n" +
      readIfExists("src/services/exportHandleStorage.ts");

    const routeSource = readSource("backend/routes/exports.ts");
    const docsSource =
      readIfExists("docs/known-issues.md") + "\n" + readIfExists("docs/phases.md");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");

    expect(routeSource).not.toContain("createSignedUrl");
    expect(routeSource).not.toContain("getPublicUrl");

    expect(docsSource).toContain("auth");
    expect(docsSource).toContain("RLS");
    expect(docsSource).toContain("ownership");
  });
});
