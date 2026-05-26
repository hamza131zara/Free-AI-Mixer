import { expect, test } from "@playwright/test";
import express from "express";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createLocalJwksForJwtVerification } from "../../backend/auth/jwtProviderVerificationStrategy";
import { createAccountRouter, type AccountBootstrapDependencies } from "../../backend/routes/account";
import type {
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
  publicJwk.kid = "phase24-workspace-bootstrap";
  const subject = "9f8c7d6e-5b4a-4321-9d87-654321fedcba";

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "phase24-workspace-bootstrap" })
    .setIssuer(runtimeEnv.FREE_AI_MIXER_AUTH_ISSUER)
    .setAudience(runtimeEnv.FREE_AI_MIXER_AUTH_AUDIENCE)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  return {
    token,
    subject,
    jwks: createLocalJwksForJwtVerification({ keys: [publicJwk] }),
  };
};

const baseDependencies = (
  workspaces: BackendWorkspaceRecord[],
  memberships: BackendWorkspaceMembershipRecord[],
): AccountBootstrapDependencies => ({
  userAccountRepository: {
    getByUserId: async (userId) => ({
      userId,
      authProvider: "supabase",
      authSubject: userId,
    }),
    getByAuthSubject: async (_provider, authSubject) => ({
      userId: authSubject,
      authProvider: "supabase",
      authSubject,
    }),
    createOrGetByAuthSubject: async ({ userId, authProvider, authSubject, email }) => ({
      userId,
      authProvider,
      authSubject,
      ...(email ? { email } : {}),
    }),
  },
  workspaceRepository: {
    getByWorkspaceId: async (workspaceId) =>
      workspaces.find((workspace) => workspace.workspaceId === workspaceId),
    listForUser: async () => workspaces,
    createPersonalWorkspace: async ({ workspaceId, userId, name }) => ({
      workspaceId,
      createdByUserId: userId,
      name,
    }),
  },
  workspaceMembershipRepository: {
    getMembership: async (workspaceId, userId) =>
      memberships.find(
        (membership) =>
          membership.workspaceId === workspaceId && membership.userId === userId,
      ),
    listMembershipsForWorkspace: async (workspaceId) =>
      memberships.filter((membership) => membership.workspaceId === workspaceId),
    listMembershipsForUser: async (userId) =>
      memberships.filter((membership) => membership.userId === userId),
    createOrGetMembership: async ({ workspaceId, userId, role, status }) => ({
      workspaceId,
      userId,
      role,
      status,
    }),
  },
  getVerifiedAuthUserProfile: async () => ({
    email: "workspace@example.com",
    emailVerified: true,
  }),
});

test.describe("phase24 workspace membership bootstrap", () => {
  test("reuses an existing single active workspace membership without creating another workspace", async () => {
    const { token, subject, jwks } = await issueToken();
    const workspaces: BackendWorkspaceRecord[] = [
      {
        workspaceId: "workspace-existing",
        createdByUserId: subject,
        name: "Personal Workspace",
      },
    ];
    const memberships: BackendWorkspaceMembershipRecord[] = [
      {
        workspaceId: "workspace-existing",
        userId: subject,
        role: "owner",
        status: "active",
      },
    ];

    const { server, baseUrl } = await startServer({
      runtimeConfig: {
        kind: "auth_provider_configured",
        provider: "future_jwt_provider",
      },
      dependencies: baseDependencies(workspaces, memberships),
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

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        kind: "account_bootstrap_complete",
        identity: {
          workspaceId: "workspace-existing",
          workspaceRole: "workspace_owner",
          workspaceAuthority: "verified",
        },
        bootstrap: {
          workspaceCreated: false,
          membershipCreated: false,
        },
      });
    } finally {
      await stopServer(server);
    }
  });

  test("blocks bootstrap safely when multiple active memberships already exist", async () => {
    const { token, subject, jwks } = await issueToken();
    const workspaces: BackendWorkspaceRecord[] = [
      {
        workspaceId: "workspace-a",
        createdByUserId: subject,
        name: "Workspace A",
      },
      {
        workspaceId: "workspace-b",
        createdByUserId: subject,
        name: "Workspace B",
      },
    ];
    const memberships: BackendWorkspaceMembershipRecord[] = [
      {
        workspaceId: "workspace-a",
        userId: subject,
        role: "owner",
        status: "active",
      },
      {
        workspaceId: "workspace-b",
        userId: subject,
        role: "owner",
        status: "active",
      },
    ];

    const { server, baseUrl } = await startServer({
      runtimeConfig: {
        kind: "auth_provider_configured",
        provider: "future_jwt_provider",
      },
      dependencies: baseDependencies(workspaces, memberships),
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

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        kind: "workspace_bootstrap_blocked",
        status: "workspace_selection_required",
        reason: "multiple_active_memberships",
        identity: {
          userId: subject,
          workspaceAuthority: "not_available",
          workspaceAuthorityReason: "multiple_active_workspace_memberships",
        },
      });
    } finally {
      await stopServer(server);
    }
  });
});
