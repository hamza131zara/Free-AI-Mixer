import { expect, test } from "@playwright/test";
import express from "express";
import { createServer, type Server } from "node:http";
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWK,
  type KeyLike,
} from "jose";
import {
  createLocalJwksForJwtVerification,
  executeJwtVerificationWithJose,
  verifyJwtBoundaryWithJose,
} from "../../backend/auth/jwtProviderVerificationStrategy";
import {
  createAuthenticatedRequesterContext,
  createUnauthenticatedRequesterContext,
} from "../../backend/auth/requesterContext";
import { adaptAuthenticatedRequesterToExportRequesterContext } from "../../backend/auth/exportRequesterContextAdapter";
import { createRepositoryBackedRequesterContextResolver } from "../../backend/auth/requesterContextResolver";
import { createTrustedAuthMiddleware } from "../../backend/auth/trustedAuthMiddleware";
import type { TrustedAuthProviderStrategy } from "../../backend/auth/trustedAuthProviderStrategy";
import { createAuthRouter } from "../../backend/routes/auth";
import { createAccountRouter } from "../../backend/routes/account";
import { createGenerationRouter } from "../../backend/routes/generation";
import type {
  BackendUserAccountRecord,
  BackendUserAccountRepository,
  BackendWorkspaceMembershipRecord,
  BackendWorkspaceMembershipRepository,
  BackendWorkspaceRecord,
  BackendWorkspaceRepository,
} from "../../backend/repositories/repositoryContracts";

const issuer = "https://auth.example.test";
const audience = "authenticated";
const subject = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";

const jwtEnv = {
  FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS: "ES256",
  FREE_AI_MIXER_AUTH_AUDIENCE: audience,
  FREE_AI_MIXER_AUTH_ISSUER: issuer,
  FREE_AI_MIXER_AUTH_JWKS_URI: "https://auth.example.test/.well-known/jwks.json",
  FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
  FREE_AI_MIXER_AUTH_RUNTIME_ENABLED: "1",
  FREE_AI_MIXER_WORKSPACE_RUNTIME_ENABLED: "1",
};

const jwtConfig = {
  allowedAlgorithms: ["ES256"],
  audience,
  issuer,
  jwksUri: "https://auth.example.test/.well-known/jwks.json",
  keyMode: "remote_jwks" as const,
  kind: "jwt_verification_configured" as const,
};

const runtimeConfig = {
  kind: "auth_provider_configured" as const,
  provider: "future_jwt_provider" as const,
};

const startExpressServer = async (app: express.Express) => {
  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("JWT verification test server did not expose a TCP port.");
  }

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
    server,
    url: `http://127.0.0.1:${address.port}`,
  } satisfies {
    close: () => Promise<void>;
    server: Server;
    url: string;
  };
};

const createEs256Jwks = async () => {
  const { privateKey, publicKey } = await generateKeyPair("ES256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.alg = "ES256";
  publicJwk.kid = "hosted-auth-test-key";
  publicJwk.use = "sig";

  return {
    jwks: createLocalJwksForJwtVerification({ keys: [publicJwk as JWK] }),
    privateKey,
  };
};

const signToken = async ({
  audienceValue = audience,
  issuerValue = issuer,
  privateKey,
  overrides = {},
  protectedHeader = { alg: "ES256", kid: "hosted-auth-test-key" },
  subjectValue = subject,
}: {
  audienceValue?: string;
  issuerValue?: string;
  privateKey: KeyLike;
  overrides?: Record<string, unknown>;
  protectedHeader?: { alg: string; kid?: string };
  subjectValue?: string;
}): Promise<string> =>
  new SignJWT({
    email: "hosted-auth@example.test",
    ...overrides,
  })
    .setProtectedHeader(protectedHeader)
    .setIssuer(issuerValue)
    .setAudience(audienceValue)
    .setSubject(subjectValue)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);

const createRepositories = ({
  accountLookupCount = { value: 0 },
  createdWorkspaceId = { value: undefined as string | undefined },
  initialAccountExists = true,
  initialMembershipExists = true,
  initialWorkspaceExists = true,
  membershipCreateCount = { value: 0 },
  userCreateCount = { value: 0 },
  workspaceCreateCount = { value: 0 },
}: {
  accountLookupCount?: { value: number };
  createdWorkspaceId?: { value: string | undefined };
  initialAccountExists?: boolean;
  initialMembershipExists?: boolean;
  initialWorkspaceExists?: boolean;
  membershipCreateCount?: { value: number };
  userCreateCount?: { value: number };
  workspaceCreateCount?: { value: number };
} = {}) => {
  let appUser: BackendUserAccountRecord | undefined = initialAccountExists
    ? {
        authProvider: "supabase",
        authSubject: subject,
        email: "hosted-auth@example.test",
        userId: subject,
      }
    : undefined;
  let workspace: BackendWorkspaceRecord | undefined = initialWorkspaceExists
    ? {
        createdByUserId: subject,
        name: "Personal Workspace",
        workspaceId,
      }
    : undefined;
  let membership: BackendWorkspaceMembershipRecord | undefined =
    initialMembershipExists && workspace
      ? {
          role: "owner",
          status: "active",
          userId: subject,
          workspaceId: workspace.workspaceId,
        }
      : undefined;

  const userAccountRepository: BackendUserAccountRepository = {
    createOrGetByAuthSubject: async (input) => {
      if (!appUser) {
        userCreateCount.value += 1;
        appUser = {
          authProvider: input.authProvider,
          authSubject: input.authSubject,
          userId: input.userId,
          ...(input.email ? { email: input.email } : {}),
        };
      }

      return appUser;
    },
    getByAuthSubject: async (_authProvider, authSubject) => {
      accountLookupCount.value += 1;
      return appUser?.authSubject === authSubject ? appUser : undefined;
    },
    getByUserId: async (userId) =>
      appUser?.userId === userId ? appUser : undefined,
  };

  const workspaceRepository: BackendWorkspaceRepository = {
    createPersonalWorkspace: async (input) => {
      if (!workspace) {
        workspaceCreateCount.value += 1;
        workspace = {
          createdByUserId: input.userId,
          name: input.name,
          workspaceId: input.workspaceId,
        };
        createdWorkspaceId.value = workspace.workspaceId;
      }

      return workspace;
    },
    getByWorkspaceId: async (id) =>
      workspace?.workspaceId === id ? workspace : undefined,
    listForUser: async (userId) =>
      workspace?.createdByUserId === userId ? [workspace] : [],
  };

  const workspaceMembershipRepository: BackendWorkspaceMembershipRepository = {
    createOrGetMembership: async (input) => {
      if (!membership) {
        membershipCreateCount.value += 1;
        membership = {
          role: input.role,
          status: input.status,
          userId: input.userId,
          workspaceId: input.workspaceId,
        };
      }

      return membership;
    },
    getMembership: async (targetWorkspaceId, userId) =>
      membership?.workspaceId === targetWorkspaceId && membership.userId === userId
        ? membership
        : undefined,
    listMembershipsForUser: async (userId) =>
      membership?.userId === userId ? [membership] : [],
    listMembershipsForWorkspace: async (targetWorkspaceId) =>
      membership?.workspaceId === targetWorkspaceId ? [membership] : [],
  };

  return {
    workspaceMembershipRepository,
    workspaceRepository,
    userAccountRepository,
  };
};

const serializedDoesNotLeak = (value: unknown): void => {
  const serialized = JSON.stringify(value);

  for (const forbidden of [
    '"authorization":',
    '"Authorization":',
    "Bearer ",
    '"accessToken":',
    '"access_token":',
    '"refreshToken":',
    '"refresh_token":',
    '"jwt":',
    '"jwks":',
    "service-role",
    "service_role",
    "encrypted_payload",
    "secret_ref",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

test.describe("hosted auth JWT verification with Supabase ES256 JWKS boundary", () => {
  test("valid ES256 token verifies through the injected JWKS seam", async () => {
    const { jwks, privateKey } = await createEs256Jwks();
    const token = await signToken({ privateKey });

    const result = await verifyJwtBoundaryWithJose(
      { token },
      jwtConfig,
      {
        executeRealVerification: true,
        jwks,
      },
    );

    expect(result).toMatchObject({
      identity: {
        authProvider: "jwt",
        authSubject: subject,
        email: "hosted-auth@example.test",
        supabaseUserId: subject,
      },
      kind: "verified",
    });
    expect(result).toMatchObject({
      claimsIgnoredForAuthorization: expect.arrayContaining([
        "workspaceId",
        "workspaceRole",
      ]),
    });
    serializedDoesNotLeak(result);
  });

  test("invalid JWT inputs map to safe enum-only failures", async () => {
    const { jwks, privateKey } = await createEs256Jwks();
    const validToken = await signToken({ privateKey });
    const wrongIssuerToken = await signToken({
      issuerValue: "https://wrong-issuer.example.test",
      privateKey,
    });
    const wrongAudienceToken = await signToken({
      audienceValue: "wrong-audience",
      privateKey,
    });
    const expiredToken = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: "hosted-auth-test-key" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(subject)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(privateKey);
    const futureNbfToken = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: "hosted-auth-test-key" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(subject)
      .setIssuedAt()
      .setNotBefore("10m")
      .setExpirationTime("15m")
      .sign(privateKey);
    const missingSubjectToken = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: "hosted-auth-test-key" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    const { privateKey: rsaPrivateKey } = await generateKeyPair("RS256");
    const wrongAlgorithmToken = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(rsaPrivateKey);

    const verify = (token?: string) =>
      verifyJwtBoundaryWithJose(
        token ? { token } : {},
        jwtConfig,
        {
          executeRealVerification: true,
          jwks,
        },
      );

    await expect(verify()).resolves.toEqual({
      kind: "not_verified",
      reason: "missing_bearer_token",
    });
    await expect(verify("not-a-jwt")).resolves.toEqual({
      kind: "not_verified",
      reason: "malformed_token",
    });
    await expect(verify(wrongAlgorithmToken)).resolves.toEqual({
      kind: "not_verified",
      reason: "disallowed_algorithm",
    });
    await expect(verify(wrongIssuerToken)).resolves.toEqual({
      kind: "not_verified",
      reason: "invalid_issuer",
    });
    await expect(verify(wrongAudienceToken)).resolves.toEqual({
      kind: "not_verified",
      reason: "invalid_audience",
    });
    await expect(verify(expiredToken)).resolves.toEqual({
      kind: "not_verified",
      reason: "token_expired",
    });
    await expect(verify(futureNbfToken)).resolves.toEqual({
      kind: "not_verified",
      reason: "invalid_credentials",
    });
    await expect(verify(missingSubjectToken)).resolves.toEqual({
      kind: "not_verified",
      reason: "invalid_credentials",
    });

    await expect(verify(validToken)).resolves.toMatchObject({
      kind: "verified",
    });
  });

  test("missing config and JWKS failures stay fail-closed without leaking internals", async () => {
    const { privateKey } = await createEs256Jwks();
    const token = await signToken({ privateKey });
    const failingJwks = (async () => {
      throw new Error("JWKS fetch failed");
    }) as unknown as ReturnType<typeof createLocalJwksForJwtVerification>;

    await expect(
      executeJwtVerificationWithJose(
        { headers: { authorization: `Bearer ${token}` } },
        { kind: "jwt_verification_not_configured", reason: "missing_issuer" },
        { executeRealVerification: true },
      ),
    ).resolves.toEqual({
      kind: "not_verified",
      reason: "auth_not_configured",
    });

    await expect(
      executeJwtVerificationWithJose(
        { headers: { authorization: `Bearer ${token}` } },
        jwtConfig,
        {
          executeRealVerification: true,
          jwks: failingJwks,
        },
      ),
    ).resolves.toEqual({
      kind: "not_verified",
      reason: "auth_provider_unavailable",
    });
  });

  test("auth provider outages propagate through export and generation contracts safely", async () => {
    expect(
      adaptAuthenticatedRequesterToExportRequesterContext(
        createUnauthenticatedRequesterContext("auth_provider_unavailable"),
        "authenticated_session",
      ),
    ).toEqual({
      kind: "not_authenticated",
      reason: "auth_provider_unavailable",
    });
    expect(
      adaptAuthenticatedRequesterToExportRequesterContext(
        createUnauthenticatedRequesterContext("missing_credentials"),
        "authenticated_session",
      ),
    ).toEqual({
      kind: "not_authenticated",
      reason: "missing_credentials",
    });
    expect(
      adaptAuthenticatedRequesterToExportRequesterContext(
        createUnauthenticatedRequesterContext("invalid_credentials"),
        "authenticated_session",
      ),
    ).toEqual({
      kind: "not_authenticated",
      reason: "invalid_credentials",
    });

    const providerStrategy: TrustedAuthProviderStrategy = {
      kind: "future_jwt_provider",
      resolveRequesterContext: async () =>
        createUnauthenticatedRequesterContext("auth_provider_unavailable"),
    };
    const app = express();
    app.use(express.json());
    app.use(createTrustedAuthMiddleware({ providerStrategy }));
    app.use(createGenerationRouter({ runtimeConfig }));
    const server = await startExpressServer(app);

    try {
      const response = await fetch(`${server.url}/generation/runtime-status`);
      const body = await response.json();

      expect(response.status).toBe(501);
      expect(body).toEqual({
        kind: "generation_runtime_unavailable",
        status: "auth_provider_unavailable",
        message:
          "Authentication is configured but generation runtime access is not enabled in this product phase.",
      });
      serializedDoesNotLeak(body);
    } finally {
      await server.close();
    }
  });

  test("/auth/session verifies once, ignores spoofed headers, and returns repository-owned identity", async () => {
    const { jwks, privateKey } = await createEs256Jwks();
    const token = await signToken({ privateKey });
    let middlewareVerificationCount = 0;
    const accountLookupCount = { value: 0 };
    const repositories = createRepositories({ accountLookupCount });
    const providerStrategy: TrustedAuthProviderStrategy = {
      kind: "future_jwt_provider",
      resolveRequesterContext: async (input) => {
        middlewareVerificationCount += 1;
        const result = await executeJwtVerificationWithJose(
          { headers: input?.headers },
          jwtConfig,
          {
            executeRealVerification: true,
            jwks,
          },
        );

        if (result.kind !== "verified") {
          return createUnauthenticatedRequesterContext(result.reason);
        }

        return createAuthenticatedRequesterContext({
          authProvider: result.authProvider,
          authSubject: result.authSubject,
          userId: result.userId,
        });
      },
    };
    const requesterContextResolver = createRepositoryBackedRequesterContextResolver({
      env: jwtEnv,
      jwtVerificationExecutionOptions: {
        jwks: (async () => {
          throw new Error("resolver must reuse trusted requester context");
        }) as unknown as ReturnType<typeof createLocalJwksForJwtVerification>,
      },
      repositories,
    });
    const app = express();
    app.use(express.json());
    app.use(createTrustedAuthMiddleware({ providerStrategy }));
    app.use(
      createAuthRouter({
        requesterContextResolver,
        runtimeConfig,
      }),
    );
    const server = await startExpressServer(app);

    try {
      const response = await fetch(`${server.url}/auth/session`, {
        headers: {
          authorization: `Bearer ${token}`,
          "x-user-id": "spoofed-user",
          "x-workspace-id": "spoofed-workspace",
        },
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        identity: {
          authProvider: "supabase",
          authSubject: subject,
          email: "hosted-auth@example.test",
          userId: subject,
          workspaceAuthority: "verified",
          workspaceId,
          workspaceRole: "workspace_owner",
        },
        kind: "authenticated_session",
        status: "authenticated",
      });
      expect(JSON.stringify(body)).not.toContain("spoofed");
      expect(middlewareVerificationCount).toBe(1);
      expect(accountLookupCount.value).toBe(1);
      serializedDoesNotLeak(body);
    } finally {
      await server.close();
    }
  });

  test("/account/bootstrap runs only after verified JWT identity and returns backend-created records", async () => {
    const { jwks, privateKey } = await createEs256Jwks();
    const token = await signToken({ privateKey });
    let middlewareVerificationCount = 0;
    let profileLookupCount = 0;
    const membershipCreateCount = { value: 0 };
    const userCreateCount = { value: 0 };
    const workspaceCreateCount = { value: 0 };
    const createdWorkspaceId = { value: undefined as string | undefined };
    const repositories = createRepositories({
      createdWorkspaceId,
      initialAccountExists: false,
      initialMembershipExists: false,
      initialWorkspaceExists: false,
      membershipCreateCount,
      userCreateCount,
      workspaceCreateCount,
    });
    const providerStrategy: TrustedAuthProviderStrategy = {
      kind: "future_jwt_provider",
      resolveRequesterContext: async (input) => {
        const result = await executeJwtVerificationWithJose(
          { headers: input?.headers },
          jwtConfig,
          {
            executeRealVerification: true,
            jwks,
          },
        );

        if (result.kind !== "verified") {
          return createUnauthenticatedRequesterContext(result.reason);
        }

        middlewareVerificationCount += 1;
        return createAuthenticatedRequesterContext({
          authProvider: result.authProvider,
          authSubject: result.authSubject,
          userId: result.userId,
        });
      },
    };
    const app = express();
    app.use(express.json());
    app.use(createTrustedAuthMiddleware({ providerStrategy }));
    app.use(
      createAccountRouter({
        dependencies: {
          ...repositories,
          getVerifiedAuthUserProfile: async (userId) => {
            profileLookupCount += 1;
            return {
              email: `${userId}@example.test`,
              emailVerified: true,
            };
          },
        },
        env: jwtEnv,
        jwtVerificationExecutionOptions: {
          jwks: (async () => {
            throw new Error("bootstrap must reuse trusted requester context");
          }) as unknown as ReturnType<typeof createLocalJwksForJwtVerification>,
        },
        runtimeConfig,
      }),
    );
    const server = await startExpressServer(app);

    try {
      const missingResponse = await fetch(`${server.url}/account/bootstrap`, {
        method: "POST",
      });
      const missingBody = await missingResponse.json();

      expect(missingResponse.status).toBe(401);
      expect(missingBody).toMatchObject({
        kind: "invalid_credentials",
        reason: "missing_credentials",
        status: "unauthenticated",
      });
      expect(userCreateCount.value).toBe(0);
      expect(workspaceCreateCount.value).toBe(0);
      expect(membershipCreateCount.value).toBe(0);

      const response = await fetch(`${server.url}/account/bootstrap`, {
        headers: {
          authorization: `Bearer ${token}`,
          "x-user-id": "spoofed-user",
          "x-workspace-id": "spoofed-workspace",
        },
        method: "POST",
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        bootstrap: {
          appUserCreated: true,
          membershipCreated: true,
          workspaceCreated: true,
        },
        identity: {
          authProvider: "supabase",
          authSubject: subject,
          userId: subject,
          workspaceAuthority: "verified",
          workspaceRole: "workspace_owner",
        },
        kind: "account_bootstrap_complete",
        status: "authenticated",
      });
      expect(typeof body.identity.workspaceId).toBe("string");
      expect(createdWorkspaceId.value).toBe(body.identity.workspaceId);
      expect(body.identity.workspaceId).not.toBe(workspaceId);
      expect(body.identity.workspaceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(JSON.stringify(body)).not.toContain("spoofed");
      expect(userCreateCount.value).toBe(1);
      expect(workspaceCreateCount.value).toBe(1);
      expect(membershipCreateCount.value).toBe(1);

      const repeatedResponse = await fetch(`${server.url}/account/bootstrap`, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        method: "POST",
      });
      const repeatedBody = await repeatedResponse.json();

      expect(repeatedResponse.status).toBe(200);
      expect(repeatedBody).toMatchObject({
        bootstrap: {
          appUserCreated: false,
          membershipCreated: false,
          workspaceCreated: false,
        },
        identity: {
          authProvider: "supabase",
          authSubject: subject,
          userId: subject,
          workspaceAuthority: "verified",
          workspaceId: body.identity.workspaceId,
          workspaceRole: "workspace_owner",
        },
        kind: "account_bootstrap_complete",
        status: "authenticated",
      });
      expect(userCreateCount.value).toBe(1);
      expect(workspaceCreateCount.value).toBe(1);
      expect(membershipCreateCount.value).toBe(1);
      expect(middlewareVerificationCount).toBe(2);
      expect(profileLookupCount).toBe(2);
      serializedDoesNotLeak({ body, missingBody, repeatedBody });
    } finally {
      await server.close();
    }
  });
});
