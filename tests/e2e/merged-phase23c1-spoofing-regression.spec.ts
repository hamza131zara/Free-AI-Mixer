import { expect, test } from "@playwright/test";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  createLocalJwksForJwtVerification,
} from "../../backend/auth/jwtProviderVerificationStrategy";
import { createRepositoryBackedRequesterContextResolver } from "../../backend/auth/requesterContextResolver";
import { createProjectHistoryRouter } from "../../backend/routes/projectHistory";
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

const startServer = async (): Promise<{
  server: Server;
  baseUrl: string;
  token: string;
}> => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "phase23c1-spoof";

  const token = await new SignJWT({
    workspaceId: "workspace-from-claim-must-not-authorize",
    workspaceRole: "owner",
    platformRole: "platform_admin",
  })
    .setProtectedHeader({ alg: "RS256", kid: "phase23c1-spoof" })
    .setIssuer(baseEnv.FREE_AI_MIXER_AUTH_ISSUER)
    .setAudience(baseEnv.FREE_AI_MIXER_AUTH_AUDIENCE)
    .setSubject("supabase-user-bridge-023c1")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  const userAccountRepository: BackendUserAccountRepository = {
    getByUserId: async () => undefined,
    getByAuthSubject: async () => ({
      userId: "app-user-023c1",
      authProvider: "supabase",
      authSubject: "supabase-user-bridge-023c1",
      email: "user023c1@example.test",
    }),
  };
  const workspaceRepository: BackendWorkspaceRepository = {
    getByWorkspaceId: async () => undefined,
    listForUser: async () => [
      {
        workspaceId: "workspace-from-db-verified",
        ownerUserId: "app-user-023c1",
      },
    ],
  };
  const workspaceMembershipRepository: BackendWorkspaceMembershipRepository = {
    getMembership: async () => ({
      workspaceId: "workspace-from-db-verified",
      userId: "app-user-023c1",
      role: "admin",
      status: "active",
    }),
    listMembershipsForWorkspace: async () => [],
  };

  const routeAccessResolver = createRepositoryBackedRequesterContextResolver({
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

  const app = express();
  app.use(
    createProjectHistoryRouter({
      runtimeConfig: {
        kind: "auth_provider_configured",
        provider: "future_jwt_provider",
        issuer: baseEnv.FREE_AI_MIXER_AUTH_ISSUER,
        audience: baseEnv.FREE_AI_MIXER_AUTH_AUDIENCE,
      },
      routeAccessResolver,
    }),
  );

  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    token,
  };
};

const stopServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

test.describe("merged phase 23C-1 spoofing regression", () => {
  test("selected protected routes ignore spoof headers and JWT workspace claims", async () => {
    const { server, baseUrl, token } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/project-library/projects`, {
        headers: {
          authorization: `Bearer ${token}`,
          "x-user-id": "spoofed-user-must-not-authenticate",
          "x-workspace-id": "spoofed-workspace-must-not-authorize",
        },
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        kind: "project_library",
        status: "authenticated",
        activeWorkspaceId: "workspace-from-db-verified",
      });
    } finally {
      await stopServer(server);
    }
  });
});
