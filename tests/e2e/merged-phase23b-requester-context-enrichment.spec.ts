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
  FREE_AI_MIXER_WORKSPACE_RUNTIME_ENABLED: "0",
  FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
  FREE_AI_MIXER_AUTH_ISSUER: "https://issuer.example.test/auth/v1",
  FREE_AI_MIXER_AUTH_AUDIENCE: "authenticated",
  FREE_AI_MIXER_AUTH_JWKS_URI:
    "https://issuer.example.test/auth/v1/.well-known/jwks.json",
  FREE_AI_MIXER_AUTH_JWT_KEY_MODE: "remote_jwks",
  FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS: "RS256",
} as const;

test.describe("merged phase 23B requester context enrichment", () => {
  test("verified JWT identity enriches to app user without trusting workspace claims", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = "phase23b-enrichment";

    const token = await new SignJWT({
      workspaceId: "workspace-from-claim-must-not-authorize",
      workspaceRole: "owner",
      platformRole: "platform_admin",
    })
      .setProtectedHeader({ alg: "RS256", kid: "phase23b-enrichment" })
      .setIssuer(baseEnv.FREE_AI_MIXER_AUTH_ISSUER)
      .setAudience(baseEnv.FREE_AI_MIXER_AUTH_AUDIENCE)
      .setSubject("supabase-user-bridge-001")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    const userAccountRepository: BackendUserAccountRepository = {
      getByUserId: async () => undefined,
      getByAuthSubject: async () => ({
        userId: "app-user-001",
        authProvider: "supabase",
        authSubject: "supabase-user-bridge-001",
        email: "user@example.test",
      }),
    };
    const workspaceRepository: BackendWorkspaceRepository = {
      getByWorkspaceId: async () => undefined,
      listForUser: async () => [],
    };
    const workspaceMembershipRepository: BackendWorkspaceMembershipRepository = {
      getMembership: async () => undefined,
      listMembershipsForWorkspace: async () => [],
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
      kind: "authenticated",
      userId: "app-user-001",
      appUserId: "app-user-001",
      supabaseUserId: "supabase-user-bridge-001",
      authProvider: "supabase",
      authSubject: "supabase-user-bridge-001",
      email: "user@example.test",
      workspaceAuthority: "not_available",
      workspaceAuthorityReason: "workspace_runtime_not_enabled",
    });
  });
});
