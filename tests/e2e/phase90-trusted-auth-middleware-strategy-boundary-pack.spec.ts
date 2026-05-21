import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createTrustedAuthNotConfiguredMiddleware,
  getRequesterContextFromRequest,
} from "../../backend/auth/trustedAuthMiddleware";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase90 trusted auth middleware strategy boundary pack", () => {
  test("trusted auth middleware boundary exists but remains auth-not-configured by default", async () => {
    const middleware = createTrustedAuthNotConfiguredMiddleware();

    const request = {
      headers: {
        authorization: "Bearer fake-token-must-not-authenticate",
        "x-user-id": "fake-user-must-not-authenticate",
        "x-workspace-id": "fake-workspace-must-not-authenticate",
      },
    } as any;

    let nextCalled = false;

    middleware(request, {} as any, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(getRequesterContextFromRequest(request)).toEqual({
      kind: "unauthenticated",
      reason: "auth_not_configured",
    });

    expect(request.backendRequesterContext).toEqual({
      kind: "unauthenticated",
      reason: "auth_not_configured",
    });
  });

  test("trusted auth middleware remains non-enforcing and is not wired into routes", async () => {
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const appSource = readSource("backend/app.ts");
    const serverSource = readSource("backend/server.ts");
    const requesterContextSource = readSource("backend/auth/requesterContext.ts");

    expect(middlewareSource).toContain("createTrustedAuthNotConfiguredMiddleware");
    expect(middlewareSource).toContain("getRequesterContextFromRequest");
    expect(middlewareSource).toContain("auth_not_configured");
    expect(requesterContextSource).toContain("BackendRequesterContext");

    // Phase 90 adds middleware boundary only. No route/app/server enforcement yet.
    expect(routeSource).not.toContain("createTrustedAuthNotConfiguredMiddleware");
    expect(appSource).not.toContain("createTrustedAuthNotConfiguredMiddleware");
    expect(serverSource).not.toContain("createTrustedAuthNotConfiguredMiddleware");

    expect(routeSource).not.toContain("getRequesterContextFromRequest");
    expect(appSource).not.toContain("getRequesterContextFromRequest");
    expect(serverSource).not.toContain("getRequesterContextFromRequest");

    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");

    expect(middlewareSource).not.toContain("fakeSession");
    expect(middlewareSource).not.toContain("mockAuthenticatedUser");
    expect(middlewareSource).not.toContain("service_role");
    expect(middlewareSource).not.toContain("SERVICE_ROLE");
    expect(middlewareSource).not.toContain("createSignedUrl");
    expect(middlewareSource).not.toContain("getPublicUrl");
  });

  test("frontend and artifact delivery remain blocked until real trusted auth exists", async () => {
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
