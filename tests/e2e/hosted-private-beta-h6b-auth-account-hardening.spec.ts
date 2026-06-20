import { expect, test } from "@playwright/test";
import express from "express";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createAuthenticatedRequesterContext,
  createUnauthenticatedRequesterContext,
} from "../../backend/auth/requesterContext";
import type { BackendRequesterContextRequest } from "../../backend/auth/trustedAuthMiddleware";
import { createAccountRouter } from "../../backend/routes/account";
import { createAuthRouter } from "../../backend/routes/auth";
import { sensitiveAuthCacheControlValue } from "../../backend/routes/sensitiveAuthResponse";
import type {
  BackendUserAccountRepository,
  BackendWorkspaceMembershipRepository,
  BackendWorkspaceRepository,
} from "../../backend/repositories/repositoryContracts";

const projectFile = (relativePath: string): string =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

const runtimeConfig = {
  kind: "auth_provider_configured" as const,
  provider: "future_jwt_provider" as const,
};

const verifiedSubject = "11111111-1111-4111-8111-111111111111";
const appUserId = verifiedSubject;
const workspaceId = "22222222-2222-4222-8222-222222222222";
const sentinelDatabaseError = "permission denied for table app_users";

const authenticatedRequester = createAuthenticatedRequesterContext({
  appUserId,
  authProvider: "jwt",
  authSubject: verifiedSubject,
  email: "h6b@example.test",
  userId: appUserId,
  workspaceAuthority: "verified",
  workspaceId,
  workspaceRole: "workspace_owner",
});

const startExpressServer = async (app: express.Express) => {
  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("H6-B test server did not expose a TCP port.");
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

const expectSensitiveHeaders = (response: Response): void => {
  expect(response.headers.get("cache-control")).toBe(
    sensitiveAuthCacheControlValue,
  );
  expect(response.headers.get("pragma")).toBe("no-cache");
  expect(response.headers.get("expires")).toBe("0");
};

const expectNoSensitiveLeak = (value: unknown): void => {
  const serialized = JSON.stringify(value);

  for (const forbidden of [
    sentinelDatabaseError,
    "permission denied",
    "app_users",
    "stack",
    "Authorization",
    "Bearer ",
    "access_token",
    "refresh_token",
    "service-role",
    "service_role",
    "SUPABASE_SERVICE_ROLE",
    "jwks",
    "JWKS",
    "encrypted_payload",
    "secret_ref",
    "local_path",
    "internal_ref",
    "base64",
    "bytes",
    "public_url",
    "signed_url",
    "download_url",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

const createAccountRepositories = (
  input: {
    emailVerified?: boolean;
    throwUserLookup?: boolean;
  } = {},
) => {
  const userAccountRepository: BackendUserAccountRepository = {
    createOrGetByAuthSubject: async ({ authProvider, authSubject, email, userId }) => ({
      authProvider,
      authSubject,
      email,
      userId,
    }),
    getByAuthSubject: async () => {
      if (input.throwUserLookup) {
        throw new Error(sentinelDatabaseError);
      }

      return undefined;
    },
    getByUserId: async () => undefined,
  };
  const workspaceRepository: BackendWorkspaceRepository = {
    createPersonalWorkspace: async ({ name, userId }) => ({
      createdByUserId: userId,
      name,
      workspaceId,
    }),
    getByWorkspaceId: async () => undefined,
    listForUser: async () => [],
  };
  const workspaceMembershipRepository: BackendWorkspaceMembershipRepository = {
    createOrGetMembership: async ({ role, status, userId }) => ({
      role,
      status,
      userId,
      workspaceId,
    }),
    getMembership: async () => undefined,
    listMembershipsForUser: async () => [],
    listMembershipsForWorkspace: async () => [],
  };

  return {
    getVerifiedAuthUserProfile: async () => ({
      email: "h6b@example.test",
      emailVerified: input.emailVerified ?? true,
    }),
    userAccountRepository,
    workspaceMembershipRepository,
    workspaceRepository,
  };
};

const createAuthServer = async (options: {
  requesterKind: "authenticated" | "unauthenticated" | "throw";
}) => {
  const app = express();

  app.use(
    createAuthRouter({
      runtimeConfig,
      requesterContextResolver: {
        resolve: async () => {
          if (options.requesterKind === "throw") {
            throw new Error(sentinelDatabaseError);
          }

          return options.requesterKind === "authenticated"
            ? authenticatedRequester
            : createUnauthenticatedRequesterContext("missing_credentials");
        },
      },
    }),
  );

  return startExpressServer(app);
};

const createAccountServer = async (options: {
  emailVerified?: boolean;
  throwUserLookup?: boolean;
}) => {
  const app = express();

  app.use((request, _response, next) => {
    (request as BackendRequesterContextRequest).backendRequesterContext =
      authenticatedRequester;
    next();
  });
  app.use(
    createAccountRouter({
      dependencies: createAccountRepositories(options),
      env: {
        FREE_AI_MIXER_WORKSPACE_RUNTIME_ENABLED: "1",
      },
      runtimeConfig,
    }),
  );

  return startExpressServer(app);
};

test.describe("hosted private beta H6-B auth/account hardening", () => {
  test("auth session responses use private no-store cache policy for success failure and redacted internal errors", async () => {
    const successServer = await createAuthServer({ requesterKind: "authenticated" });
    const failureServer = await createAuthServer({ requesterKind: "unauthenticated" });
    const thrownServer = await createAuthServer({ requesterKind: "throw" });

    try {
      const successResponse = await fetch(`${successServer.url}/auth/session`);
      expectSensitiveHeaders(successResponse);
      await expect(successResponse.json()).resolves.toMatchObject({
        kind: "authenticated_session",
        status: "authenticated",
      });

      const failureResponse = await fetch(`${failureServer.url}/auth/session`);
      expectSensitiveHeaders(failureResponse);
      await expect(failureResponse.json()).resolves.toMatchObject({
        kind: "unauthenticated_session",
        reason: "missing_credentials",
        status: "unauthenticated",
      });

      const thrownResponse = await fetch(`${thrownServer.url}/auth/session`);
      expectSensitiveHeaders(thrownResponse);
      expect(thrownResponse.status).toBe(503);
      const thrownPayload = await thrownResponse.json();
      expect(thrownPayload).toEqual({
        kind: "auth_unavailable",
        status: "auth_provider_unavailable",
        message: "Authentication is temporarily unavailable.",
      });
      expectNoSensitiveLeak(thrownPayload);
    } finally {
      await successServer.close();
      await failureServer.close();
      await thrownServer.close();
    }
  });

  test("account bootstrap responses use private no-store cache policy and redact repository failures", async () => {
    const successServer = await createAccountServer();
    const knownFailureServer = await createAccountServer({ emailVerified: false });
    const thrownServer = await createAccountServer({ throwUserLookup: true });

    try {
      const successResponse = await fetch(`${successServer.url}/account/bootstrap`, {
        method: "POST",
      });
      expectSensitiveHeaders(successResponse);
      await expect(successResponse.json()).resolves.toMatchObject({
        kind: "account_bootstrap_complete",
        status: "authenticated",
      });

      const knownFailureResponse = await fetch(
        `${knownFailureServer.url}/account/bootstrap`,
        { method: "POST" },
      );
      expectSensitiveHeaders(knownFailureResponse);
      expect(knownFailureResponse.status).toBe(403);
      await expect(knownFailureResponse.json()).resolves.toMatchObject({
        kind: "email_verification_required",
        status: "verification_required",
      });

      const thrownResponse = await fetch(`${thrownServer.url}/account/bootstrap`, {
        method: "POST",
      });
      expectSensitiveHeaders(thrownResponse);
      expect(thrownResponse.status).toBe(503);
      const thrownPayload = await thrownResponse.json();
      expect(thrownPayload).toEqual({
        kind: "bootstrap_unavailable",
        status: "bootstrap_unavailable",
        message: "Account bootstrap is temporarily unavailable.",
      });
      expectNoSensitiveLeak(thrownPayload);
    } finally {
      await successServer.close();
      await knownFailureServer.close();
      await thrownServer.close();
    }
  });

  test("Vercel proxies confirmed frontend backend prefixes before SPA fallback without monitoring wildcard proxy", () => {
    const config = JSON.parse(projectFile("vercel.json")) as {
      rewrites?: Array<{ destination?: string; source?: string }>;
    };
    const rewrites = config.rewrites ?? [];
    const renderOrigin = "https://free-ai-mixer.onrender.com";
    const spaFallbackIndex = rewrites.findIndex(
      (rewrite) =>
        rewrite.source === "/(.*)" && rewrite.destination === "/index.html",
    );

    expect(spaFallbackIndex).toBeGreaterThan(0);

    for (const prefix of [
      "auth",
      "account",
      "provider-settings",
      "generation",
      "credits",
      "billing",
      "project-library",
      "exports",
      "admin",
      "ai-tools",
      "ai-news",
      "cards",
      "templates",
    ]) {
      const rewriteIndex = rewrites.findIndex(
        (rewrite) =>
          rewrite.source === `/${prefix}/:path*` &&
          rewrite.destination === `${renderOrigin}/${prefix}/:path*`,
      );
      expect(rewriteIndex).toBeGreaterThanOrEqual(0);
      expect(rewriteIndex).toBeLessThan(spaFallbackIndex);
    }

    expect(rewrites).not.toContainEqual({
      source: "/monitoring/:path*",
      destination: `${renderOrigin}/monitoring/:path*`,
    });
    expect(rewrites).not.toContainEqual({
      source: "/:path*",
      destination: `${renderOrigin}/:path*`,
    });
    expect(rewrites).not.toContainEqual({
      source: "/(.*)",
      destination: `${renderOrigin}/$1`,
    });
  });

  test("hosted staging docs describe ES256 signing-key alignment without runtime gate changes", () => {
    const envExample = projectFile(".env.example");
    const stagingDoc = projectFile("docs/staging-env-example.md");
    const generationRoute = projectFile("backend/routes/generation.ts");
    const roadmap = projectFile("docs/roadmap.md");
    const sensitiveHelper = projectFile("backend/routes/sensitiveAuthResponse.ts");

    expect(envExample).toContain("FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS=ES256");
    expect(envExample).toContain("ECC P-256 / ES256");
    expect(stagingDoc).toContain("FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS=ES256");
    expect(stagingDoc).toContain("must match the hosted Supabase project's active JWT signing key");
    expect(stagingDoc).toContain("Current hosted staging uses ECC P-256 / ES256");
    expect(envExample).not.toContain("FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS=RS256");
    expect(stagingDoc).not.toContain("FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS=RS256");

    expect(sensitiveHelper).toContain(sensitiveAuthCacheControlValue);
    expect(generationRoute).toContain("real_provider_local_only");
    expect(generationRoute).toContain("platform_paid_provider_not_configured");
    expect(roadmap).toContain("no live payment processor");
  });
});
