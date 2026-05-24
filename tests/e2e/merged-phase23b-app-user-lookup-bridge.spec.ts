import { expect, test } from "@playwright/test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  createRepositoryBackedRequesterContextResolver,
} from "../../backend/auth/requesterContextResolver";
import { createLocalJwksForJwtVerification } from "../../backend/auth/jwtProviderVerificationStrategy";
import type {
  BackendUserAccountRepository,
  BackendWorkspaceMembershipRepository,
  BackendWorkspaceRepository,
} from "../../backend/repositories/repositoryContracts";

const baseEnv = {
  FREE_AI_MIXER_AUTH_RUNTIME_ENABLED: "1",
  FREE_AI_MIXER_WORKSPACE_RUNTIME_ENABLED: "1",
  FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
  FREE_AI_MIXER_AUTH_ISSUER: "https://issuer.example.test/auth/v1",
  FREE_AI_MIXER_AUTH_AUDIENCE: "authenticated",
  FREE_AI_MIXER_AUTH_JWKS_URI:
    "https://issuer.example.test/auth/v1/.well-known/jwks.json",
  FREE_AI_MIXER_AUTH_JWT_KEY_MODE: "remote_jwks",
  FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS: "RS256",
} as const;

const workspaceRepository: BackendWorkspaceRepository = {
  getByWorkspaceId: async () => undefined,
  listForUser: async () => [],
};

const workspaceMembershipRepository: BackendWorkspaceMembershipRepository = {
  getMembership: async () => undefined,
  listMembershipsForWorkspace: async () => [],
};

test.describe("merged phase 23B app-user lookup bridge", () => {
  test("valid JWT with missing app user fails closed and creates no fake user", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = "phase23b-missing-app-user";
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "phase23b-missing-app-user" })
      .setIssuer(baseEnv.FREE_AI_MIXER_AUTH_ISSUER)
      .setAudience(baseEnv.FREE_AI_MIXER_AUTH_AUDIENCE)
      .setSubject("supabase-user-missing")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    const userAccountRepository: BackendUserAccountRepository = {
      getByUserId: async () => undefined,
      getByAuthSubject: async () => undefined,
    };

    const resolver = createRepositoryBackedRequesterContextResolver({
      repositories: {
        userAccountRepository,
        workspaceRepository,
        workspaceMembershipRepository,
      },
      env: baseEnv,
      jwtVerificationExecutionOptions: {
        jwks: createLocalJwksForJwtVerification({ keys: [publicJwk] }),
      },
    });

    await expect(
      resolver.resolve({
        headers: {
          authorization: `Bearer ${token}`,
        },
      }),
    ).resolves.toEqual({
      kind: "unauthenticated",
      reason: "invalid_credentials",
    });
  });

  test("spoof headers without a bearer token cannot authenticate through the lookup bridge", async () => {
    const userAccountRepository: BackendUserAccountRepository = {
      getByUserId: async () => undefined,
      getByAuthSubject: async () => undefined,
    };

    const resolver = createRepositoryBackedRequesterContextResolver({
      repositories: {
        userAccountRepository,
        workspaceRepository,
        workspaceMembershipRepository,
      },
      env: baseEnv,
    });

    await expect(
      resolver.resolve({
        headers: {
          "x-user-id": "spoof-user",
          "x-workspace-id": "spoof-workspace",
        },
      }),
    ).resolves.toEqual({
      kind: "unauthenticated",
      reason: "missing_credentials",
    });
  });
});
