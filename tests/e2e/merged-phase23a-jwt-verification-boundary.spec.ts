import { expect, test } from "@playwright/test";
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  generateSecret,
} from "jose";
import {
  createLocalJwksForJwtVerification,
  verifyJwtBoundaryWithJose,
} from "../../backend/auth/jwtProviderVerificationStrategy";
import { readJwtVerificationConfiguration } from "../../backend/auth/jwtVerificationConfiguration";

const baseEnv = {
  FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
  FREE_AI_MIXER_AUTH_ISSUER: "https://issuer.example.test/auth/v1",
  FREE_AI_MIXER_AUTH_AUDIENCE: "authenticated",
  FREE_AI_MIXER_AUTH_JWKS_URI:
    "https://issuer.example.test/auth/v1/.well-known/jwks.json",
  FREE_AI_MIXER_AUTH_JWT_KEY_MODE: "remote_jwks",
  FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS: "RS256",
  FREE_AI_MIXER_AUTH_RUNTIME_ENABLED: "1",
} as const;

test.describe("merged phase 23A jwt verification boundary", () => {
  test("valid mocked RS256 JWT verifies as identity-only and ignores authorization claims", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = "phase23a-rs256";

    const config = readJwtVerificationConfiguration(baseEnv);
    const token = await new SignJWT({
      email: "user@example.test",
      workspaceId: "workspace-from-claim-must-not-authorize",
      workspaceRole: "owner",
      platformRole: "platform_admin",
    })
      .setProtectedHeader({ alg: "RS256", kid: "phase23a-rs256" })
      .setIssuer(baseEnv.FREE_AI_MIXER_AUTH_ISSUER)
      .setAudience(baseEnv.FREE_AI_MIXER_AUTH_AUDIENCE)
      .setSubject("supabase-user-123")
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(privateKey);

    const result = await verifyJwtBoundaryWithJose(
      { token },
      config,
      {
        executeRealVerification: true,
        jwks: createLocalJwksForJwtVerification({
          keys: [publicJwk],
        }),
      },
    );

    expect(result).toEqual({
      kind: "verified",
      identity: {
        authenticated: true,
        authProvider: "jwt",
        authSubject: "supabase-user-123",
        supabaseUserId: "supabase-user-123",
        email: "user@example.test",
      },
      claimsIgnoredForAuthorization: [
        "workspaceId",
        "workspace_id",
        "workspaceRole",
        "workspace_role",
        "platformRole",
        "platform_role",
      ],
    });

    if (result.kind === "verified") {
      expect(result.identity).not.toHaveProperty("workspaceId");
      expect(result.identity).not.toHaveProperty("workspaceRole");
      expect(result.identity).not.toHaveProperty("platformRole");
    }
  });

  test("expired wrong-issuer wrong-audience wrong-algorithm and malformed JWTs fail closed", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = "phase23a-negative";

    const jwks = createLocalJwksForJwtVerification({
      keys: [publicJwk],
    });
    const config = readJwtVerificationConfiguration(baseEnv);

    const buildToken = (builder: SignJWT) =>
      builder
        .setProtectedHeader({ alg: "RS256", kid: "phase23a-negative" })
        .setIssuer(baseEnv.FREE_AI_MIXER_AUTH_ISSUER)
        .setAudience(baseEnv.FREE_AI_MIXER_AUTH_AUDIENCE)
        .setSubject("supabase-user-456")
        .setIssuedAt();

    const expiredToken = await buildToken(new SignJWT({}))
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(privateKey);
    const wrongIssuerToken = await buildToken(new SignJWT({}))
      .setIssuer("https://wrong-issuer.example.test/auth/v1")
      .setExpirationTime("2h")
      .sign(privateKey);
    const wrongAudienceToken = await buildToken(new SignJWT({}))
      .setAudience("wrong-audience")
      .setExpirationTime("2h")
      .sign(privateKey);

    const hsSecret = await generateSecret("HS256");
    const wrongAlgorithmToken = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(baseEnv.FREE_AI_MIXER_AUTH_ISSUER)
      .setAudience(baseEnv.FREE_AI_MIXER_AUTH_AUDIENCE)
      .setSubject("supabase-user-789")
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(hsSecret);

    await expect(
      verifyJwtBoundaryWithJose(
        { token: expiredToken },
        config,
        { executeRealVerification: true, jwks },
      ),
    ).resolves.toEqual({
      kind: "not_verified",
      reason: "token_expired",
    });

    await expect(
      verifyJwtBoundaryWithJose(
        { token: wrongIssuerToken },
        config,
        { executeRealVerification: true, jwks },
      ),
    ).resolves.toEqual({
      kind: "not_verified",
      reason: "invalid_issuer",
    });

    await expect(
      verifyJwtBoundaryWithJose(
        { token: wrongAudienceToken },
        config,
        { executeRealVerification: true, jwks },
      ),
    ).resolves.toEqual({
      kind: "not_verified",
      reason: "invalid_audience",
    });

    await expect(
      verifyJwtBoundaryWithJose(
        { token: wrongAlgorithmToken },
        config,
        { executeRealVerification: true, jwks },
      ),
    ).resolves.toEqual({
      kind: "not_verified",
      reason: "disallowed_algorithm",
    });

    await expect(
      verifyJwtBoundaryWithJose(
        { token: "not-a-jwt" },
        config,
        { executeRealVerification: true, jwks },
      ),
    ).resolves.toEqual({
      kind: "not_verified",
      reason: "malformed_token",
    });
  });
});
