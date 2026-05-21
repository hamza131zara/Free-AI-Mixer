import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createTrustedAuthMiddleware,
  createTrustedAuthNotConfiguredMiddleware,
  getRequesterContextFromRequest,
} from "../../backend/auth/trustedAuthMiddleware";
import type { TrustedAuthProviderStrategy } from "../../backend/auth/trustedAuthProviderStrategy";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const runMiddleware = async (middleware: ReturnType<typeof createTrustedAuthMiddleware>, request: any) => {
  await new Promise<void>((resolve, reject) => {
    middleware(request, {} as any, (error?: unknown) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

test.describe("phase97 auth provider middleware wiring strategy pack", () => {
  test("trusted auth middleware can consume provider strategy while default remains auth-not-configured", async () => {
    const defaultRequest = {
      headers: {
        authorization: "Bearer fake-token-must-not-authenticate",
        "x-user-id": "fake-user-must-not-authenticate",
      },
    } as any;

    await runMiddleware(createTrustedAuthNotConfiguredMiddleware(), defaultRequest);

    expect(getRequesterContextFromRequest(defaultRequest)).toEqual({
      kind: "unauthenticated",
      reason: "auth_not_configured",
    });

    const strategy: TrustedAuthProviderStrategy = {
      kind: "future_session_provider",
      resolveRequesterContext: async () => ({
        kind: "authenticated",
        userId: "trusted-user-phase97",
        workspaceId: "trusted-workspace-phase97",
        authProvider: "phase97-test-provider",
        authSubject: "phase97-test-subject",
      }),
    };

    const authenticatedRequest = {
      headers: {
        authorization: "Bearer future-real-token",
      },
    } as any;

    await runMiddleware(
      createTrustedAuthMiddleware({
        providerStrategy: strategy,
      }),
      authenticatedRequest,
    );

    expect(getRequesterContextFromRequest(authenticatedRequest)).toEqual({
      kind: "authenticated",
      userId: "trusted-user-phase97",
      workspaceId: "trusted-workspace-phase97",
      authProvider: "phase97-test-provider",
      authSubject: "phase97-test-subject",
    });
  });

  test("provider middleware wiring remains non-enforcing and route authorization is still deferred", async () => {
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const providerSource = readSource("backend/auth/trustedAuthProviderStrategy.ts");
    const appSource = readSource("backend/app.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const serverSource = readSource("backend/server.ts");

    expect(middlewareSource).toContain("createTrustedAuthMiddleware");
    expect(middlewareSource).toContain("TrustedAuthProviderStrategy");
    expect(middlewareSource).toContain("resolveTrustedAuthProviderRequesterContext");
    expect(providerSource).toContain("TrustedAuthProviderStrategy");

    // App still uses the auth-not-configured wrapper, not a real provider.
    expect(appSource).toContain("createTrustedAuthNotConfiguredMiddleware");
    expect(appSource).not.toContain("future_jwt_provider");
    expect(appSource).not.toContain("future_session_provider");

    // Route/server enforcement remains deferred.
    expect(serverSource).not.toContain("createTrustedAuthMiddleware");
    expect(routeSource).not.toContain("createTrustedAuthMiddleware");
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");

    expect(middlewareSource).not.toContain("fakeSession");
    expect(middlewareSource).not.toContain("mockAuthenticatedUser");
    expect(middlewareSource).not.toContain("service_role");
    expect(middlewareSource).not.toContain("SERVICE_ROLE");
    expect(middlewareSource).not.toContain("createSignedUrl");
    expect(middlewareSource).not.toContain("getPublicUrl");
  });

  test("frontend and artifact delivery remain blocked after provider middleware strategy wiring", async () => {
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
