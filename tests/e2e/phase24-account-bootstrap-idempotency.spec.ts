import { expect, test } from "@playwright/test";
import express from "express";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createLocalJwksForJwtVerification } from "../../backend/auth/jwtProviderVerificationStrategy";
import { createAccountRouter, type AccountBootstrapDependencies } from "../../backend/routes/account";
import type {
  BackendUserAccountRecord,
  BackendWorkspaceMembershipRecord,
  BackendWorkspaceRecord,
} from "../../backend/repositories/repositoryContracts";

const runtimeEnv = {
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

const startServer = async (options: Parameters<typeof createAccountRouter>[0]) => {
  const app = express();
  app.use(createAccountRouter(options));

  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
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

const issueToken = async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "phase24-idempotency";
  const subject = "6b29fc40-ca47-1067-b31d-00dd010662da";
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "phase24-idempotency" })
    .setIssuer(runtimeEnv.FREE_AI_MIXER_AUTH_ISSUER)
    .setAudience(runtimeEnv.FREE_AI_MIXER_AUTH_AUDIENCE)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  return {
    subject,
    token,
    jwks: createLocalJwksForJwtVerification({ keys: [publicJwk] }),
  };
};

test.describe("phase24 account bootstrap idempotency", () => {
  test("duplicate bootstrap calls do not duplicate app user workspace or membership rows", async () => {
    const { token, jwks, subject } = await issueToken();
    const appUsers = new Map<string, BackendUserAccountRecord>();
    const workspaces = new Map<string, BackendWorkspaceRecord>();
    const memberships = new Map<string, BackendWorkspaceMembershipRecord>();

    const dependencies: AccountBootstrapDependencies = {
      userAccountRepository: {
        getByUserId: async (userId) => appUsers.get(userId),
        getByAuthSubject: async (_provider, authSubject) => appUsers.get(authSubject),
        createOrGetByAuthSubject: async ({ userId, authProvider, authSubject, email }) => {
          const existing = appUsers.get(authSubject);
          if (existing) {
            return existing;
          }

          const record: BackendUserAccountRecord = {
            userId,
            authProvider,
            authSubject,
            ...(email ? { email } : {}),
          };
          appUsers.set(authSubject, record);
          return record;
        },
      },
      workspaceRepository: {
        getByWorkspaceId: async (workspaceId) => workspaces.get(workspaceId),
        listForUser: async (userId) =>
          [...workspaces.values()].filter((workspace) => workspace.createdByUserId === userId),
        createPersonalWorkspace: async ({ workspaceId, userId, name }) => {
          const existing = workspaces.get(workspaceId);
          if (existing) {
            return existing;
          }

          const workspace: BackendWorkspaceRecord = {
            workspaceId,
            createdByUserId: userId,
            name,
          };
          workspaces.set(workspaceId, workspace);
          return workspace;
        },
      },
      workspaceMembershipRepository: {
        getMembership: async (workspaceId, userId) =>
          memberships.get(`${workspaceId}:${userId}`),
        listMembershipsForWorkspace: async (workspaceId) =>
          [...memberships.values()].filter((membership) => membership.workspaceId === workspaceId),
        listMembershipsForUser: async (userId) =>
          [...memberships.values()].filter((membership) => membership.userId === userId),
        createOrGetMembership: async ({ workspaceId, userId, role, status }) => {
          const key = `${workspaceId}:${userId}`;
          const existing = memberships.get(key);
          if (existing) {
            return existing;
          }

          const membership: BackendWorkspaceMembershipRecord = {
            workspaceId,
            userId,
            role,
            status,
          };
          memberships.set(key, membership);
          return membership;
        },
      },
      getVerifiedAuthUserProfile: async () => ({
        email: "idempotent@example.com",
        emailVerified: true,
      }),
    };

    const { server, baseUrl } = await startServer({
      runtimeConfig: {
        kind: "auth_provider_configured",
        provider: "future_jwt_provider",
      },
      dependencies,
      env: runtimeEnv,
      jwtVerificationExecutionOptions: { jwks },
    });

    try {
      const first = await fetch(`${baseUrl}/account/bootstrap`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const second = await fetch(`${baseUrl}/account/bootstrap`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      await expect(first.json()).resolves.toMatchObject({
        kind: "account_bootstrap_complete",
        status: "authenticated",
      });
      await expect(second.json()).resolves.toMatchObject({
        kind: "account_bootstrap_complete",
        status: "authenticated",
      });

      expect(appUsers.size).toBe(1);
      expect(workspaces.size).toBe(1);
      expect(memberships.size).toBe(1);
      expect(appUsers.get(subject)?.authProvider).toBe("supabase");
    } finally {
      await stopServer(server);
    }
  });
});
