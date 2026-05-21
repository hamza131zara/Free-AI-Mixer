import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  isTrustedAuthProviderRuntimeConfigured,
  readTrustedAuthProviderRuntimeConfig,
} from "../../backend/auth/trustedAuthProviderRuntimeConfig";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase99 auth provider runtime configuration boundary pack", () => {
  test("runtime config reader handles disabled missing and supported provider modes without secrets", async () => {
    expect(readTrustedAuthProviderRuntimeConfig({})).toEqual({
      kind: "auth_provider_not_configured",
      reason: "missing_provider",
    });

    expect(
      readTrustedAuthProviderRuntimeConfig({
        FREE_AI_MIXER_AUTH_PROVIDER: "disabled",
      }),
    ).toEqual({
      kind: "auth_provider_not_configured",
      reason: "disabled",
    });

    expect(
      readTrustedAuthProviderRuntimeConfig({
        FREE_AI_MIXER_AUTH_PROVIDER: "unsupported-provider",
      }),
    ).toEqual({
      kind: "auth_provider_not_configured",
      reason: "unsupported_provider",
    });

    const jwtConfig = readTrustedAuthProviderRuntimeConfig({
      FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
      FREE_AI_MIXER_AUTH_ISSUER: "https://auth.example.test",
      FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
    });

    expect(jwtConfig).toEqual({
      kind: "auth_provider_configured",
      provider: "future_jwt_provider",
      issuer: "https://auth.example.test",
      audience: "free-ai-mixer",
    });

    expect(isTrustedAuthProviderRuntimeConfigured(jwtConfig)).toBe(true);

    const sessionConfig = readTrustedAuthProviderRuntimeConfig({
      FREE_AI_MIXER_AUTH_PROVIDER: "session",
    });

    expect(sessionConfig).toEqual({
      kind: "auth_provider_configured",
      provider: "future_session_provider",
      issuer: undefined,
      audience: undefined,
    });
  });

  test("runtime config boundary is not wired into app middleware routes or server yet", async () => {
    const configSource = readSource("backend/auth/trustedAuthProviderRuntimeConfig.ts");
    const providerSource = readSource("backend/auth/trustedAuthProviderStrategy.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");
    const appSource = readSource("backend/app.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const serverSource = readSource("backend/server.ts");

    expect(configSource).toContain("readTrustedAuthProviderRuntimeConfig");
    expect(configSource).toContain("isTrustedAuthProviderRuntimeConfigured");
    expect(configSource).toContain("FREE_AI_MIXER_AUTH_PROVIDER");
    expect(configSource).toContain("future_jwt_provider");
    expect(configSource).toContain("future_session_provider");

    expect(providerSource).toContain("TrustedAuthProviderStrategy");
    expect(middlewareSource).toContain("createTrustedAuthMiddleware");

    // Phase 99 adds config boundary only. No app/middleware/route/server wiring yet.
    expect(providerSource).not.toContain("readTrustedAuthProviderRuntimeConfig");
    expect(middlewareSource).toContain("readTrustedAuthProviderRuntimeConfig");
    expect(appSource).not.toContain("readTrustedAuthProviderRuntimeConfig");
    expect(routeSource).not.toContain("readTrustedAuthProviderRuntimeConfig");
    expect(serverSource).not.toContain("readTrustedAuthProviderRuntimeConfig");

    expect(appSource).toContain("createTrustedAuthNotConfiguredMiddleware");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("runtime config boundary does not introduce fake auth secrets frontend storage or artifact delivery", async () => {
    const configSource = readSource("backend/auth/trustedAuthProviderRuntimeConfig.ts");
    const authSource =
      configSource +
      "\n" +
      readSource("backend/auth/trustedAuthMiddleware.ts") +
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

