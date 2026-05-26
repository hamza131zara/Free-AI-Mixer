import { expect, test } from "@playwright/test";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { AsyncBackendRequesterContextResolver } from "../../backend/auth/requesterContextResolver";
import { createCreditsRouter } from "../../backend/routes/credits";
import type { TrustedAuthProviderRuntimeConfig } from "../../backend/auth/trustedAuthProviderRuntimeConfig";

const startServer = async (
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
  routeAccessResolver?: AsyncBackendRequesterContextResolver,
): Promise<{ server: Server; baseUrl: string }> => {
  const app = express();
  app.use(
    createCreditsRouter({
      runtimeConfig,
      ...(routeAccessResolver ? { routeAccessResolver } : {}),
    }),
  );

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

test.describe("merged phase 23C-2 credits status enforcement", () => {
  test("credits status fails closed for unauthenticated requests and auth-not-configured runtime", async () => {
    const unauthenticatedResolver: AsyncBackendRequesterContextResolver = {
      resolve: async () => ({
        kind: "unauthenticated",
        reason: "invalid_credentials",
      }),
    };

    const unauthenticatedServer = await startServer(
      {
        kind: "auth_provider_configured",
        provider: "future_jwt_provider",
        issuer: "https://issuer.example.test/auth/v1",
        audience: "authenticated",
      },
      unauthenticatedResolver,
    );

    try {
      const response = await fetch(`${unauthenticatedServer.baseUrl}/credits/status`);
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({
        kind: "credits_sign_in_required",
        status: "unauthenticated",
        reason: "invalid_credentials",
        message: "Sign in is required before workspace-owned credit status can be checked.",
      });
    } finally {
      await stopServer(unauthenticatedServer.server);
    }

    const unavailableServer = await startServer({
      kind: "auth_provider_not_configured",
      reason: "missing_provider",
    });

    try {
      const response = await fetch(`${unavailableServer.baseUrl}/credits/status`);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        kind: "credits_unavailable",
        status: "auth_not_configured",
        message: "Authentication is not configured on this backend yet.",
      });
    } finally {
      await stopServer(unavailableServer.server);
    }
  });

  test("credits status fails closed for workspace runtime disabled and missing workspace authority", async () => {
    const workspaceRuntimeDisabledResolver: AsyncBackendRequesterContextResolver = {
      resolve: async () => ({
        kind: "authenticated",
        userId: "app-user-credits-001",
        appUserId: "app-user-credits-001",
        supabaseUserId: "supabase-user-credits-001",
        authProvider: "supabase",
        authSubject: "supabase-user-credits-001",
        workspaceAuthority: "not_available",
        workspaceAuthorityReason: "workspace_runtime_not_enabled",
      }),
    };

    const workspaceRuntimeDisabledServer = await startServer(
      {
        kind: "auth_provider_configured",
        provider: "future_jwt_provider",
        issuer: "https://issuer.example.test/auth/v1",
        audience: "authenticated",
      },
      workspaceRuntimeDisabledResolver,
    );

    try {
      const response = await fetch(
        `${workspaceRuntimeDisabledServer.baseUrl}/credits/status`,
      );
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        kind: "credits_unavailable",
        status: "workspace_runtime_not_configured",
        message: "Workspace authority is not configured on this backend yet.",
      });
    } finally {
      await stopServer(workspaceRuntimeDisabledServer.server);
    }

    const missingWorkspaceAuthorityResolver: AsyncBackendRequesterContextResolver = {
      resolve: async () => ({
        kind: "authenticated",
        userId: "app-user-credits-002",
        appUserId: "app-user-credits-002",
        supabaseUserId: "supabase-user-credits-002",
        authProvider: "supabase",
        authSubject: "supabase-user-credits-002",
        workspaceAuthority: "not_available",
        workspaceAuthorityReason: "no_active_workspace_membership",
      }),
    };

    const missingWorkspaceAuthorityServer = await startServer(
      {
        kind: "auth_provider_configured",
        provider: "future_jwt_provider",
        issuer: "https://issuer.example.test/auth/v1",
        audience: "authenticated",
      },
      missingWorkspaceAuthorityResolver,
    );

    try {
      const response = await fetch(
        `${missingWorkspaceAuthorityServer.baseUrl}/credits/status`,
      );
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        kind: "credits_access_required",
        status: "workspace_required",
        message:
          "A verified workspace is required before this protected route can continue.",
      });
    } finally {
      await stopServer(missingWorkspaceAuthorityServer.server);
    }
  });
});
