import { expect, test } from "@playwright/test";
import {
  resolveJwtVerificationRuntimeExecution,
  verifyJwtBoundaryWithJose,
} from "../../backend/auth/jwtProviderVerificationStrategy";
import { readJwtVerificationConfiguration } from "../../backend/auth/jwtVerificationConfiguration";

test.describe("merged phase 23A jwt config fail-closed", () => {
  test("incomplete config and disabled runtime fail closed without remote dependency", async () => {
    expect(
      readJwtVerificationConfiguration({
        FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
        FREE_AI_MIXER_AUTH_ISSUER: "https://issuer.example.test/auth/v1",
        FREE_AI_MIXER_AUTH_AUDIENCE: "authenticated",
        FREE_AI_MIXER_AUTH_JWKS_URI:
          "https://issuer.example.test/auth/v1/.well-known/jwks.json",
      }),
    ).toEqual({
      kind: "jwt_verification_not_configured",
      reason: "missing_allowed_algorithms",
    });

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

    const config = readJwtVerificationConfiguration({
      FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
      FREE_AI_MIXER_AUTH_ISSUER: "https://issuer.example.test/auth/v1",
      FREE_AI_MIXER_AUTH_AUDIENCE: "authenticated",
      FREE_AI_MIXER_AUTH_JWKS_URI:
        "https://issuer.example.test/auth/v1/.well-known/jwks.json",
      FREE_AI_MIXER_AUTH_JWT_KEY_MODE: "remote_jwks",
      FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS: "RS256",
    });

    await expect(
      verifyJwtBoundaryWithJose({ token: "fake-token" }, config, {
        executeRealVerification: false,
      }),
    ).resolves.toEqual({
      kind: "not_verified",
      reason: "verification_not_enabled",
    });

    await expect(
      verifyJwtBoundaryWithJose({}, config, {
        executeRealVerification: true,
      }),
    ).resolves.toEqual({
      kind: "not_verified",
      reason: "missing_bearer_token",
    });

    await expect(
      verifyJwtBoundaryWithJose(
        { token: "fake-token" },
        undefined,
        { executeRealVerification: true },
      ),
    ).resolves.toEqual({
      kind: "not_verified",
      reason: "auth_not_configured",
    });
  });
});
