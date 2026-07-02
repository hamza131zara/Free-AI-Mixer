import { expect, test } from "@playwright/test";
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWK,
  type KeyLike,
} from "jose";

import {
  createLocalJwksForJwtVerification,
  type JwtVerificationExecutionOptions,
} from "../../backend/auth/jwtProviderVerificationStrategy";
import { decideRequesterContext } from "../../backend/auth/requesterContextDecision";
import { createRepositoryBackedRequesterContextResolver } from "../../backend/auth/requesterContextResolver";
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
const workspaceA = "22222222-2222-4222-8222-222222222222";
const workspaceB = "33333333-3333-4333-8333-333333333333";

const authEnv = {
  FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS: "ES256",
  FREE_AI_MIXER_AUTH_AUDIENCE: audience,
  FREE_AI_MIXER_AUTH_ISSUER: issuer,
  FREE_AI_MIXER_AUTH_JWKS_URI:
    "https://auth.example.test/.well-known/jwks.json",
  FREE_AI_MIXER_AUTH_PROVIDER: "jwt",
  FREE_AI_MIXER_AUTH_RUNTIME_ENABLED: "1",
  FREE_AI_MIXER_WORKSPACE_RUNTIME_ENABLED: "1",
};

const createSigningKey = async () => {
  const { privateKey, publicKey } = await generateKeyPair("ES256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.alg = "ES256";
  publicJwk.kid = "h6g2-prebootstrap-key";
  publicJwk.use = "sig";

  return {
    jwks: createLocalJwksForJwtVerification({ keys: [publicJwk as JWK] }),
    privateKey,
  };
};

const signToken = async ({
  audienceValue = audience,
  expiresAt = "5m",
  issuerValue = issuer,
  privateKey,
}: {
  audienceValue?: string;
  expiresAt?: number | string;
  issuerValue?: string;
  privateKey: KeyLike;
}): Promise<string> =>
  new SignJWT({ email: "new-user@example.test" })
    .setProtectedHeader({ alg: "ES256", kid: "h6g2-prebootstrap-key" })
    .setIssuer(issuerValue)
    .setAudience(audienceValue)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(privateKey);

interface RepositoryFixtureOptions {
  appUser?: BackendUserAccountRecord;
  memberships?: BackendWorkspaceMembershipRecord[];
  workspaces?: BackendWorkspaceRecord[];
}

const createRepositoryFixture = ({
  appUser,
  memberships = [],
  workspaces = [],
}: RepositoryFixtureOptions = {}) => {
  const writes = {
    appUsers: 0,
    memberships: 0,
    workspaces: 0,
  };

  const userAccountRepository: BackendUserAccountRepository = {
    createOrGetByAuthSubject: async (input) => {
      writes.appUsers += 1;
      return {
        created: true,
        userAccount: {
          authProvider: input.authProvider,
          authSubject: input.authSubject,
          userId: input.userId,
        },
      };
    },
    getByAuthSubject: async (_provider, authSubject) =>
      appUser?.authSubject === authSubject ? appUser : undefined,
    getByUserId: async (userId) =>
      appUser?.userId === userId ? appUser : undefined,
  };

  const workspaceRepository: BackendWorkspaceRepository = {
    createPersonalWorkspace: async (input) => {
      writes.workspaces += 1;
      return {
        created: true,
        workspace: {
          createdByUserId: input.userId,
          name: input.name,
          workspaceId: input.workspaceId,
        },
      };
    },
    getByWorkspaceId: async (workspaceId) =>
      workspaces.find((workspace) => workspace.workspaceId === workspaceId),
    listForUser: async (userId) =>
      workspaces.filter((workspace) => workspace.createdByUserId === userId),
  };

  const workspaceMembershipRepository: BackendWorkspaceMembershipRepository = {
    createOrGetMembership: async (input) => {
      writes.memberships += 1;
      return {
        created: true,
        membership: input,
      };
    },
    getMembership: async (workspaceId, userId) =>
      memberships.find(
        (membership) =>
          membership.workspaceId === workspaceId && membership.userId === userId,
      ),
    listMembershipsForUser: async (userId) =>
      memberships.filter((membership) => membership.userId === userId),
    listMembershipsForWorkspace: async (workspaceId) =>
      memberships.filter(
        (membership) => membership.workspaceId === workspaceId,
      ),
  };

  return {
    repositories: {
      userAccountRepository,
      workspaceMembershipRepository,
      workspaceRepository,
    },
    writes,
  };
};

const createResolver = (
  repositories: ReturnType<typeof createRepositoryFixture>["repositories"],
  jwks: JwtVerificationExecutionOptions["jwks"],
) =>
  createRepositoryBackedRequesterContextResolver({
    env: authEnv,
    jwtVerificationExecutionOptions: { jwks },
    repositories,
  });

const resolveWithToken = (
  resolver: ReturnType<typeof createResolver>,
  token?: string,
) =>
  resolver.resolve({
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

const existingAppUser: BackendUserAccountRecord = {
  authProvider: "supabase",
  authSubject: subject,
  email: "existing-user@example.test",
  userId: subject,
};

const existingWorkspaces: BackendWorkspaceRecord[] = [
  {
    createdByUserId: subject,
    name: "Workspace A",
    workspaceId: workspaceA,
  },
  {
    createdByUserId: subject,
    name: "Workspace B",
    workspaceId: workspaceB,
  },
];

const membership = (
  workspaceId: string,
  role: BackendWorkspaceMembershipRecord["role"] = "owner",
): BackendWorkspaceMembershipRecord => ({
  role,
  status: "active",
  userId: subject,
  workspaceId,
});

test("valid JWT without app user remains authenticated but has no workspace authority or writes", async () => {
  const { jwks, privateKey } = await createSigningKey();
  const token = await signToken({ privateKey });
  const fixture = createRepositoryFixture();
  const requester = await resolveWithToken(
    createResolver(fixture.repositories, jwks),
    token,
  );

  expect(requester).toEqual({
    kind: "authenticated",
    userId: subject,
    authProvider: "supabase",
    authSubject: subject,
    supabaseUserId: subject,
    workspaceAuthority: "not_available",
    workspaceAuthorityReason: "no_active_workspace_membership",
  });
  expect(requester).not.toHaveProperty("appUserId");
  expect(requester).not.toHaveProperty("workspaceId");
  expect(requester).not.toHaveProperty("workspaceRole");
  expect(fixture.writes).toEqual({
    appUsers: 0,
    memberships: 0,
    workspaces: 0,
  });

  expect(decideRequesterContext(requester, { requireWorkspace: true })).toEqual({
    kind: "missing_workspace",
    message:
      "A verified workspace is required before this protected route can continue.",
  });
});

test("existing app user with one active membership preserves verified workspace behavior", async () => {
  const { jwks, privateKey } = await createSigningKey();
  const token = await signToken({ privateKey });
  const fixture = createRepositoryFixture({
    appUser: existingAppUser,
    memberships: [membership(workspaceA)],
    workspaces: existingWorkspaces,
  });

  await expect(
    resolveWithToken(createResolver(fixture.repositories, jwks), token),
  ).resolves.toMatchObject({
    kind: "authenticated",
    userId: subject,
    appUserId: subject,
    supabaseUserId: subject,
    workspaceAuthority: "verified",
    workspaceId: workspaceA,
    workspaceRole: "workspace_owner",
  });
  expect(fixture.writes).toEqual({
    appUsers: 0,
    memberships: 0,
    workspaces: 0,
  });
});

test("existing app user with zero active memberships remains authenticated without authority", async () => {
  const { jwks, privateKey } = await createSigningKey();
  const token = await signToken({ privateKey });
  const fixture = createRepositoryFixture({
    appUser: existingAppUser,
    workspaces: existingWorkspaces,
  });

  await expect(
    resolveWithToken(createResolver(fixture.repositories, jwks), token),
  ).resolves.toMatchObject({
    kind: "authenticated",
    appUserId: subject,
    workspaceAuthority: "not_available",
    workspaceAuthorityReason: "no_active_workspace_membership",
  });
});

test("existing app user with multiple active memberships remains authenticated without authority", async () => {
  const { jwks, privateKey } = await createSigningKey();
  const token = await signToken({ privateKey });
  const fixture = createRepositoryFixture({
    appUser: existingAppUser,
    memberships: [membership(workspaceA), membership(workspaceB, "admin")],
    workspaces: existingWorkspaces,
  });

  await expect(
    resolveWithToken(createResolver(fixture.repositories, jwks), token),
  ).resolves.toMatchObject({
    kind: "authenticated",
    appUserId: subject,
    workspaceAuthority: "not_available",
    workspaceAuthorityReason: "multiple_active_workspace_memberships",
  });
});

test("missing and cryptographically invalid JWTs remain unauthenticated", async () => {
  const { jwks, privateKey } = await createSigningKey();
  const { privateKey: wrongPrivateKey } = await createSigningKey();
  const fixture = createRepositoryFixture();
  const resolver = createResolver(fixture.repositories, jwks);
  const expiredToken = await signToken({
    expiresAt: Math.floor(Date.now() / 1000) - 30,
    privateKey,
  });
  const wrongIssuerToken = await signToken({
    issuerValue: "https://wrong-issuer.example.test",
    privateKey,
  });
  const wrongAudienceToken = await signToken({
    audienceValue: "wrong-audience",
    privateKey,
  });
  const wrongSignatureToken = await signToken({ privateKey: wrongPrivateKey });

  await expect(resolveWithToken(resolver)).resolves.toEqual({
    kind: "unauthenticated",
    reason: "missing_credentials",
  });

  for (const token of [
    "not-a-jwt",
    expiredToken,
    wrongIssuerToken,
    wrongAudienceToken,
    wrongSignatureToken,
  ]) {
    await expect(resolveWithToken(resolver, token)).resolves.toEqual({
      kind: "unauthenticated",
      reason: "invalid_credentials",
    });
  }

  expect(fixture.writes).toEqual({
    appUsers: 0,
    memberships: 0,
    workspaces: 0,
  });
});
