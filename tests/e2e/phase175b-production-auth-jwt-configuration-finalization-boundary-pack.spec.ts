import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  resolveProductionJwtAuthReadiness,
} from "../../backend/auth/productionJwtAuthReadiness";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase175b production auth jwt configuration finalization boundary pack", () => {
  test("production jwt readiness fails closed for missing or incomplete configuration", async () => {
    expect(resolveProductionJwtAuthReadiness({})).toEqual({
      kind: "unavailable",
      reason: "missing_provider",
      providerConfigured: false,
      jwksConfigured: false,
      routeRuntimeEnabled: false,
      realVerificationEnabled: false,
    });

    expect(
      resolveProductionJwtAuthReadiness({
        FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "missing_issuer",
      providerConfigured: false,
      jwksConfigured: false,
      routeRuntimeEnabled: false,
      realVerificationEnabled: false,
    });

    expect(
      resolveProductionJwtAuthReadiness({
        FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
        FREE_AI_MIXER_AUTH_ISSUER: "https://auth.example",
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "missing_audience",
      providerConfigured: false,
      jwksConfigured: false,
      routeRuntimeEnabled: false,
      realVerificationEnabled: false,
    });

    expect(
      resolveProductionJwtAuthReadiness({
        FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
        FREE_AI_MIXER_AUTH_ISSUER: "https://auth.example",
        FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
        FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS: "RS256",
        FREE_AI_MIXER_AUTH_JWT_KEY_MODE: "static_public_key",
        FREE_AI_MIXER_AUTH_JWKS_URI: "https://auth.example/.well-known/jwks.json",
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "unsupported_key_mode",
      providerConfigured: false,
      jwksConfigured: false,
      routeRuntimeEnabled: false,
      realVerificationEnabled: false,
    });

    expect(
      resolveProductionJwtAuthReadiness({
        FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
        FREE_AI_MIXER_AUTH_ISSUER: "https://auth.example",
        FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
        FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS: "RS256",
        FREE_AI_MIXER_AUTH_JWKS_URI: "not a url",
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "invalid_jwks_uri",
      providerConfigured: false,
      jwksConfigured: false,
      routeRuntimeEnabled: false,
      realVerificationEnabled: false,
    });
  });

  test("production jwt readiness accepts complete remote jwks config without enabling runtime rollout", async () => {
    expect(
      resolveProductionJwtAuthReadiness({
        FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
        FREE_AI_MIXER_AUTH_ISSUER: "https://auth.example",
        FREE_AI_MIXER_AUTH_AUDIENCE: "free-ai-mixer",
        FREE_AI_MIXER_AUTH_JWKS_URI: "https://auth.example/.well-known/jwks.json",
        FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS: "RS256,ES256",
      }),
    ).toEqual({
      kind: "ready",
      provider: "jwt",
      issuer: "https://auth.example",
      audience: "free-ai-mixer",
      jwksUri: "https://auth.example/.well-known/jwks.json",
      keyMode: "remote_jwks",
      allowedAlgorithms: ["RS256", "ES256"],
      providerConfigured: true,
      jwksConfigured: true,
      routeRuntimeEnabled: false,
      realVerificationEnabled: false,
    });
  });

  test("production jwt readiness boundary is not route wired and exposes no trusted header or service role shortcut", async () => {
    const readinessSource = readSource("backend/auth/productionJwtAuthReadiness.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const trustedAuthSource =
      readSource("backend/auth/trustedAuthMiddleware.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthProviderComposition.ts") +
      "\n" +
      readSource("backend/auth/jwtProviderVerificationStrategy.ts") +
      "\n" +
      readSource("backend/auth/jwtVerificationConfiguration.ts");

    const frontendSource =
      readSource("src/services/artifactDeliveryDescriptorService.ts") +
      "\n" +
      readSource("src/store/artifactDeliveryDescriptorStore.ts") +
      "\n" +
      readSource("src/services/artifactDownloadNavigationStrategy.ts") +
      "\n" +
      readIfExists("src/services/supabaseClient.ts") +
      "\n" +
      readIfExists("src/lib/supabase.ts");

    expect(readinessSource).toContain("resolveProductionJwtAuthReadiness");
    expect(readinessSource).toContain("routeRuntimeEnabled: false");
    expect(readinessSource).toContain("realVerificationEnabled: false");
    expect(readinessSource).toContain("constructRemoteJwksForJwtVerification");
    expect(readinessSource).toContain("readJwtVerificationConfiguration");

    expect(routeSource).not.toContain("resolveProductionJwtAuthReadiness");
    expect(routeSource).not.toContain("productionJwtAuthReadiness");

    expect(trustedAuthSource + routeSource).not.toContain('req.headers["x-user-id"]');
    expect(trustedAuthSource + routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(trustedAuthSource + routeSource).not.toContain("fakeSession");
    expect(trustedAuthSource + routeSource).not.toContain("mockAuthenticatedUser");
    expect(trustedAuthSource + routeSource).not.toContain("trustUserHeader");
    expect(trustedAuthSource + routeSource).not.toContain("trustWorkspaceHeader");
    expect(trustedAuthSource + routeSource).not.toContain("service_role");
    expect(trustedAuthSource + routeSource).not.toContain("SERVICE_ROLE");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("SERVICE_ROLE");
  });
});
