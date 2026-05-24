import { expect, test } from "@playwright/test";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { AsyncBackendRequesterContextResolver } from "../../backend/auth/requesterContextResolver";
import { createProviderSettingsRouter } from "../../backend/routes/providerSettings";
import type { TrustedAuthProviderRuntimeConfig } from "../../backend/auth/trustedAuthProviderRuntimeConfig";

const startServer = async (
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
  routeAccessResolver?: AsyncBackendRequesterContextResolver,
): Promise<{ server: Server; baseUrl: string }> => {
  const app = express();
  app.use(
    createProviderSettingsRouter({
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

test.describe("merged phase 23C-1 provider settings status enforcement", () => {
  test("provider settings status fails closed for unauthenticated and workspace-runtime-disabled requests", async () => {
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
      const response = await fetch(
        `${unauthenticatedServer.baseUrl}/provider-settings/status`,
      );
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({
        kind: "provider_settings_sign_in_required",
        status: "unauthenticated",
        reason: "invalid_credentials",
        message: "Sign in is required before provider settings can be managed.",
      });
    } finally {
      await stopServer(unauthenticatedServer.server);
    }

    const workspaceRuntimeDisabledResolver: AsyncBackendRequesterContextResolver = {
      resolve: async () => ({
        kind: "authenticated",
        userId: "app-user-001",
        appUserId: "app-user-001",
        supabaseUserId: "supabase-user-001",
        authProvider: "supabase",
        authSubject: "supabase-user-001",
        workspaceAuthority: "not_available",
        workspaceAuthorityReason: "workspace_runtime_not_enabled",
      }),
    };
    const unavailableServer = await startServer(
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
        `${unavailableServer.baseUrl}/provider-settings/status`,
      );
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        kind: "provider_settings_unavailable",
        status: "workspace_runtime_not_configured",
        message: "Workspace authority is not configured on this backend yet.",
      });
    } finally {
      await stopServer(unavailableServer.server);
    }
  });

  test("provider settings status stays truthful and secret-free for verified workspace authority", async () => {
    const routeAccessResolver: AsyncBackendRequesterContextResolver = {
      resolve: async () => ({
        kind: "authenticated",
        userId: "app-user-002",
        appUserId: "app-user-002",
        supabaseUserId: "supabase-user-002",
        authProvider: "supabase",
        authSubject: "supabase-user-002",
        workspaceId: "workspace-verified-002",
        workspaceRole: "workspace_admin",
        workspaceAuthority: "verified",
      }),
    };
    const { server, baseUrl } = await startServer(
      {
        kind: "auth_provider_configured",
        provider: "future_jwt_provider",
        issuer: "https://issuer.example.test/auth/v1",
        audience: "authenticated",
      },
      routeAccessResolver,
    );

    try {
      const response = await fetch(`${baseUrl}/provider-settings/status`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        kind: string;
        status: string;
        activeWorkspaceId?: string;
        connections: Array<{ maskedKeySummary?: string; providerId: string }>;
      };

      expect(body.kind).toBe("provider_settings_status");
      expect(body.status).toBe("authenticated");
      expect(body.activeWorkspaceId).toBe("workspace-verified-002");
      expect(JSON.stringify(body)).not.toContain("service_role");
      expect(JSON.stringify(body)).not.toContain("sk-");
      expect(JSON.stringify(body)).not.toContain("encryptedPayload");
      expect(body.connections.every((connection) => connection.providerId.length > 0)).toBe(
        true,
      );
    } finally {
      await stopServer(server);
    }
  });
});
