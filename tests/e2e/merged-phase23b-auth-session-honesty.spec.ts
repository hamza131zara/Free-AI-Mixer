import { expect, test } from "@playwright/test";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createAuthRouter } from "../../backend/routes/auth";
import type { AsyncBackendRequesterContextResolver } from "../../backend/auth/requesterContextResolver";

const startServer = async (
  resolver?: AsyncBackendRequesterContextResolver,
): Promise<{ server: Server; baseUrl: string }> => {
  const app = express();
  app.use(
    createAuthRouter({
      runtimeConfig: {
        kind: "auth_provider_configured",
        provider: "future_jwt_provider",
        issuer: "https://issuer.example.test/auth/v1",
        audience: "authenticated",
      },
      ...(resolver ? { requesterContextResolver: resolver } : {}),
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

test.describe("merged phase 23B auth session honesty", () => {
  test("/auth/session can report backend-derived identity without fabricating workspace authority", async () => {
    const resolver: AsyncBackendRequesterContextResolver = {
      resolve: async () => ({
        kind: "authenticated",
        userId: "app-user-123",
        appUserId: "app-user-123",
        supabaseUserId: "supabase-user-123",
        authProvider: "supabase",
        authSubject: "supabase-user-123",
        workspaceAuthority: "not_available",
        workspaceAuthorityReason: "workspace_runtime_not_enabled",
      }),
    };

    const { server, baseUrl } = await startServer(resolver);

    try {
      const response = await fetch(`${baseUrl}/auth/session`);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        kind: "authenticated_session",
        status: "authenticated",
        message:
          "Backend identity verified. Workspace authority is not enabled on this backend yet.",
        identity: {
          userId: "app-user-123",
          appUserId: "app-user-123",
          supabaseUserId: "supabase-user-123",
          authProvider: "supabase",
          authSubject: "supabase-user-123",
          workspaceAuthority: "not_available",
          workspaceAuthorityReason: "workspace_runtime_not_enabled",
        },
      });
    } finally {
      await stopServer(server);
    }
  });
});
