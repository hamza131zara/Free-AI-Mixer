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

const userAccountRepository: BackendUserAccountRepository = {
  getByUserId: async () => undefined,
  getByAuthSubject: async () => ({
    userId: "app-user-bridge",
    authProvider: "supabase",
    authSubject: "supabase-user-bridge",
  }),
};

const issueToken = async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "phase23b-workspace";
  const token = await new SignJWT({
    workspaceId: "workspace-claim-must-not-authorize",
    workspaceRole: "owner",
    platformRole: "platform_admin",
  })
    .setProtectedHeader({ alg: "RS256", kid: "phase23b-workspace" })
    .setIssuer(baseEnv.FREE_AI_MIXER_AUTH_ISSUER)
    .setAudience(baseEnv.FREE_AI_MIXER_AUTH_AUDIENCE)
    .setSubject("supabase-user-bridge")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  return {
    token,
    jwks: createLocalJwksForJwtVerification({ keys: [publicJwk] }),
  };
};

test.describe("merged phase 23B workspace membership bridge", () => {
  test("workspace authority comes only from backend membership lookup", async () => {
    const { token, jwks } = await issueToken();
    const workspaceRepository: BackendWorkspaceRepository = {
      getByWorkspaceId: async () => undefined,
      listForUser: async () => [
        {
          workspaceId: "workspace-real-001",
          name: "Real Workspace",
          createdByUserId: "app-user-bridge",
        },
      ],
    };
    const workspaceMembershipRepository: BackendWorkspaceMembershipRepository = {
      getMembership: async () => ({
        workspaceId: "workspace-real-001",
        userId: "app-user-bridge",
        role: "admin",
        status: "active",
      }),
      listMembershipsForWorkspace: async () => [],
    };

    const resolver = createRepositoryBackedRequesterContextResolver({
      repositories: {
        userAccountRepository,
        workspaceRepository,
        workspaceMembershipRepository,
      },
      env: baseEnv,
      jwtVerificationExecutionOptions: { jwks },
    });

    await expect(
      resolver.resolve({
        headers: {
          authorization: `Bearer ${token}`,
          "x-workspace-id": "workspace-spoof-must-not-authorize",
        },
      }),
    ).resolves.toEqual({
      kind: "authenticated",
      userId: "app-user-bridge",
      appUserId: "app-user-bridge",
      supabaseUserId: "supabase-user-bridge",
      authProvider: "supabase",
      authSubject: "supabase-user-bridge",
      workspaceAuthority: "verified",
      workspaceId: "workspace-real-001",
      workspaceRole: "workspace_admin",
    });
  });

  test("missing or ambiguous memberships grant no workspace authority and do not auto-create a workspace", async () => {
    const { token, jwks } = await issueToken();
    const workspaceRepository: BackendWorkspaceRepository = {
      getByWorkspaceId: async () => undefined,
      listForUser: async () => [
        {
          workspaceId: "workspace-a",
          name: "Workspace A",
          createdByUserId: "app-user-bridge",
        },
        {
          workspaceId: "workspace-b",
          name: "Workspace B",
          createdByUserId: "app-user-bridge",
        },
      ],
    };
    const workspaceMembershipRepository: BackendWorkspaceMembershipRepository = {
      getMembership: async (workspaceId) => ({
        workspaceId,
        userId: "app-user-bridge",
        role: "member",
        status: "active",
      }),
      listMembershipsForWorkspace: async () => [],
    };

    const resolver = createRepositoryBackedRequesterContextResolver({
      repositories: {
        userAccountRepository,
        workspaceRepository,
        workspaceMembershipRepository,
      },
      env: baseEnv,
      jwtVerificationExecutionOptions: { jwks },
    });

    await expect(
      resolver.resolve({
        headers: {
          authorization: `Bearer ${token}`,
        },
      }),
    ).resolves.toEqual({
      kind: "authenticated",
      userId: "app-user-bridge",
      appUserId: "app-user-bridge",
      supabaseUserId: "supabase-user-bridge",
      authProvider: "supabase",
      authSubject: "supabase-user-bridge",
      workspaceAuthority: "not_available",
      workspaceAuthorityReason: "multiple_active_workspace_memberships",
    });
  });
});
