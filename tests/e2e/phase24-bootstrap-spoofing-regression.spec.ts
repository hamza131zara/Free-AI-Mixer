import { expect, test } from "@playwright/test";
import express from "express";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createLocalJwksForJwtVerification } from "../../backend/auth/jwtProviderVerificationStrategy";
import { createAccountRouter, type AccountBootstrapDependencies } from "../../backend/routes/account";

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
  app.use(express.json());
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
  publicJwk.kid = "phase24-spoofing";
  const subject = "123e4567-e89b-12d3-a456-426614174000";
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "phase24-spoofing" })
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

test.describe("phase24 bootstrap spoofing regression", () => {
  test("frontend-supplied user and workspace authority fields are ignored", async () => {
    const { token, jwks, subject } = await issueToken();
    const dependencies: AccountBootstrapDependencies = {
      userAccountRepository: {
        getByUserId: async () => undefined,
        getByAuthSubject: async () => undefined,
        createOrGetByAuthSubject: async ({ userId, authProvider, authSubject, email }) => ({
          userId,
          authProvider,
          authSubject,
          ...(email ? { email } : {}),
        }),
      },
      workspaceRepository: {
        getByWorkspaceId: async () => undefined,
        listForUser: async () => [],
        createPersonalWorkspace: async ({ workspaceId, userId, name }) => ({
          workspaceId,
          createdByUserId: userId,
          name,
        }),
      },
      workspaceMembershipRepository: {
        getMembership: async () => undefined,
        listMembershipsForWorkspace: async () => [],
        listMembershipsForUser: async () => [],
        createOrGetMembership: async ({ workspaceId, userId, role, status }) => ({
          workspaceId,
          userId,
          role,
          status,
        }),
      },
      getVerifiedAuthUserProfile: async () => ({
        email: "spoofing@example.com",
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
      const response = await fetch(`${baseUrl}/account/bootstrap`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-user-id": "spoof-user",
          "x-workspace-id": "spoof-workspace",
          "x-workspace-role": "workspace_admin",
          "x-platform-role": "platform_admin",
        },
        body: JSON.stringify({
          userId: "spoof-body-user",
          authSubject: "spoof-body-subject",
          workspaceId: "spoof-body-workspace",
          workspaceRole: "owner",
          platformRole: "platform_admin",
        }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        kind: "account_bootstrap_complete",
        identity: {
          userId: subject,
          authSubject: subject,
          authProvider: "supabase",
        },
      });
    } finally {
      await stopServer(server);
    }
  });
});
