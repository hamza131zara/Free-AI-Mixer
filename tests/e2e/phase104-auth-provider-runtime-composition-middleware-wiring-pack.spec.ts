import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createTrustedAuthMiddleware,
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

const runMiddleware = async (
  middleware: ReturnType<typeof createTrustedAuthMiddleware>,
  request: any,
): Promise<void> => {
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

test.describe("phase104 auth provider runtime composition middleware wiring pack", () => {
  test("middleware can consume runtime config composition while app wrapper stays auth-not-configured", async () => {
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

    const jwtRuntimeRequest = {
      headers: {
        authorization: "Bearer fake-token-must-not-authenticate",
        "x-user-id": "fake-user-must-not-authenticate",
        "x-workspace-id": "fake-workspace-must-not-authenticate",
      },
    } as any;

    await runMiddleware(
      createTrustedAuthMiddleware({
        runtimeConfig: {
          kind: "auth_provider_configured",
          provider: "future_jwt_provider",
          issuer: "https://auth.example.test",
          audience: "free-ai-mixer",
        },
      }),
      jwtRuntimeRequest,
    );

    expect(getRequesterContextFromRequest(jwtRuntimeRequest)).toEqual({
      kind: "unauthenticated",
      reason: "invalid_credentials",
    });
  });

  test("middleware wires runtime composition but app routes and server remain non-enforcing", async () => {
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const compositionSource = readSource("backend/auth/trustedAuthProviderComposition.ts");
    const configSource = readSource("backend/auth/trustedAuthProviderRuntimeConfig.ts");
    const appSource = readSource("backend/app.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const serverSource = readSource("backend/server.ts");

    expect(middlewareSource).toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");
    expect(middlewareSource).toContain("readTrustedAuthProviderRuntimeConfig");
    expect(middlewareSource).toContain("runtimeConfig");
    expect(compositionSource).toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");
    expect(configSource).toContain("readTrustedAuthProviderRuntimeConfig");

    // App/server still do not wire runtime config or real provider behavior.
    expect(appSource).toContain("createTrustedAuthMiddleware");
    expect(appSource).toContain("readTrustedAuthProviderRuntimeConfig");
    expect(appSource).not.toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");
    expect(serverSource).not.toContain("readTrustedAuthProviderRuntimeConfig");
    expect(serverSource).not.toContain("createTrustedAuthProviderStrategyFromRuntimeConfig");

    // Routes still read trusted context non-enforcing only.
    expect(routeSource).toContain("getRequesterContextFromRequest");
    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("runtime composition middleware wiring does not introduce fake auth or artifact delivery", async () => {
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

