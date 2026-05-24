import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { exportJWK, generateKeyPair } from "jose";
import { resolveSupabaseAuthRuntimeStrategy } from "../../backend/auth/supabaseAuthRuntimeStrategy";
import {
  createLocalJwksForJwtVerification,
  resolveJwtVerificationRuntimeExecution,
} from "../../backend/auth/jwtProviderVerificationStrategy";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("merged phase 23A no remote supabase dependency", () => {
  test("default runtime stays non-live and the verifier supports local mocked jwks", async () => {
    expect(
      resolveJwtVerificationRuntimeExecution({
        FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
        FREE_AI_MIXER_AUTH_ISSUER: "https://issuer.example.test/auth/v1",
        FREE_AI_MIXER_AUTH_AUDIENCE: "authenticated",
        FREE_AI_MIXER_AUTH_JWKS_URI:
          "https://issuer.example.test/auth/v1/.well-known/jwks.json",
        FREE_AI_MIXER_AUTH_JWT_KEY_MODE: "remote_jwks",
        FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS: "RS256",
      }),
    ).toEqual({
      kind: "jwt_runtime_execution",
      configured: true,
      runtimeEnabled: false,
      realVerificationEnabled: false,
    });

    expect(
      resolveSupabaseAuthRuntimeStrategy(),
    ).toMatchObject({
      liveRuntimeEnabled: false,
      jwtVerificationEnabled: false,
      workspaceLookupEnabled: false,
      serviceRoleFrontendAllowed: false,
    });

    const { publicKey } = await generateKeyPair("RS256");
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = "phase23a-local-jwks";
    const localJwks = createLocalJwksForJwtVerification({ keys: [publicJwk] });
    expect(typeof localJwks).toBe("function");

    const authBoundarySources = [
      readSource("backend/auth/jwtProviderVerificationStrategy.ts"),
      readSource("backend/auth/supabaseAuthRuntimeStrategy.ts"),
      readSource("backend/auth/productionJwtAuthReadiness.ts"),
      readSource("backend/auth/productionAuthReadiness.ts"),
      readSource("backend/config/supabaseConfig.ts"),
      readSource("backend/db/supabaseClientFactory.ts"),
    ].join("\n");

    expect(authBoundarySources).toContain("createLocalJWKSet");
    expect(authBoundarySources).toContain("createRemoteJWKSet");
    expect(authBoundarySources).not.toContain("supabase start");
    expect(authBoundarySources).not.toContain("supabase db push");
    expect(authBoundarySources).not.toContain("service_role_frontend_allowed");
  });
});
