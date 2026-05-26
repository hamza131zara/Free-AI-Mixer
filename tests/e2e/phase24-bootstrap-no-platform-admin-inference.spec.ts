import { expect, test } from "@playwright/test";
import express from "express";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
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

test.describe("phase24 bootstrap no platform admin inference", () => {
  test("workspace owner bootstrap does not imply platform admin", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = "phase24-no-platform-admin";
    const subject = "550e8400-e29b-41d4-a716-446655440000";
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "phase24-no-platform-admin" })
      .setIssuer(runtimeEnv.FREE_AI_MIXER_AUTH_ISSUER)
      .setAudience(runtimeEnv.FREE_AI_MIXER_AUTH_AUDIENCE)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    const dependencies: AccountBootstrapDependencies = {
      userAccountRepository: {
        getByUserId: async () => undefined,
        getByAuthSubject: async () => undefined,
        createOrGetByAuthSubject: async ({ userId, authProvider, authSubject }) => ({
          userId,
          authProvider,
          authSubject,
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
        email: "owner@example.com",
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
      jwtVerificationExecutionOptions: {
        jwks: createLocalJwksForJwtVerification({ keys: [publicJwk] }),
      },
    });

    try {
      const response = await fetch(`${baseUrl}/account/bootstrap`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.status).toBe(200);
      const payload = await response.json();

      expect(payload.identity.workspaceRole).toBe("workspace_owner");
      expect(JSON.stringify(payload)).not.toContain("platform_admin");
      expect(JSON.stringify(payload)).not.toContain("platformRole");
    } finally {
      await stopServer(server);
    }

    const source = readFileSync(
      path.join(process.cwd(), "backend", "routes", "account.ts"),
      "utf8",
    );
    expect(source).not.toContain("platform_admin");
    expect(source).not.toContain("platformRole");
  });
});
