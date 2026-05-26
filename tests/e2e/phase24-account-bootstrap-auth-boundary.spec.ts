import { expect, test } from "@playwright/test";
import express from "express";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createLocalJwksForJwtVerification } from "../../backend/auth/jwtProviderVerificationStrategy";
import { createAccountRouter, type AccountBootstrapDependencies } from "../../backend/routes/account";

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

const createDependencies = (): AccountBootstrapDependencies => ({
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
    email: "verified@example.com",
    emailVerified: true,
  }),
});

const issueToken = async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "phase24-auth-boundary";

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "phase24-auth-boundary" })
    .setIssuer(runtimeEnv.FREE_AI_MIXER_AUTH_ISSUER)
    .setAudience(runtimeEnv.FREE_AI_MIXER_AUTH_AUDIENCE)
    .setSubject("8d0c7b42-2e48-4bc8-b80b-5774ac418df2")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  return {
    token,
    jwks: createLocalJwksForJwtVerification({ keys: [publicJwk] }),
  };
};

test.describe("phase24 account bootstrap auth boundary", () => {
  test("fails closed when auth runtime is not configured", async () => {
    const { server, baseUrl } = await startServer({
      runtimeConfig: {
        kind: "auth_provider_not_configured",
        reason: "missing_provider",
      },
    });

    try {
      const response = await fetch(`${baseUrl}/account/bootstrap`, {
        method: "POST",
      });

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        kind: "bootstrap_unavailable",
        status: "auth_not_configured",
        message: "Authentication is not configured on this backend yet.",
      });
    } finally {
      await stopServer(server);
    }
  });

  test("rejects missing bearer and bootstrap remains unavailable when dependencies are absent", async () => {
    const { token, jwks } = await issueToken();
    const { server, baseUrl } = await startServer({
      runtimeConfig: {
        kind: "auth_provider_configured",
        provider: "future_jwt_provider",
      },
      env: runtimeEnv,
      jwtVerificationExecutionOptions: { jwks },
    });

    try {
      const missingBearerResponse = await fetch(`${baseUrl}/account/bootstrap`, {
        method: "POST",
      });

      expect(missingBearerResponse.status).toBe(401);
      await expect(missingBearerResponse.json()).resolves.toEqual({
        kind: "invalid_credentials",
        status: "unauthenticated",
        reason: "missing_credentials",
        message:
          "A verified bearer token is required before account setup can continue.",
      });

      const missingDependenciesResponse = await fetch(`${baseUrl}/account/bootstrap`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(missingDependenciesResponse.status).toBe(503);
      await expect(missingDependenciesResponse.json()).resolves.toEqual({
        kind: "bootstrap_unavailable",
        status: "bootstrap_unavailable",
        message: "Account bootstrap is not available on this backend yet.",
      });
    } finally {
      await stopServer(server);
    }
  });

  test("rejects unverified email before first bootstrap", async () => {
    const { token, jwks } = await issueToken();
    const dependencies = createDependencies();
    dependencies.getVerifiedAuthUserProfile = async () => ({
      email: "pending@example.com",
      emailVerified: false,
    });

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
        },
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        kind: "email_verification_required",
        status: "verification_required",
        message:
          "Check your email to verify your account before Free AI Mixer account setup can continue.",
      });
    } finally {
      await stopServer(server);
    }
  });
});
