import { expect, test } from "@playwright/test";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { AsyncBackendRequesterContextResolver } from "../../backend/auth/requesterContextResolver";
import { createProjectHistoryRouter } from "../../backend/routes/projectHistory";
import type { TrustedAuthProviderRuntimeConfig } from "../../backend/auth/trustedAuthProviderRuntimeConfig";

const startServer = async (
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
  routeAccessResolver?: AsyncBackendRequesterContextResolver,
): Promise<{ server: Server; baseUrl: string }> => {
  const app = express();
  app.use(
    createProjectHistoryRouter({
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

test.describe("merged phase 23C-1 project library route enforcement", () => {
  test("selected project history routes fail closed when sign-in is required", async () => {
    const routeAccessResolver: AsyncBackendRequesterContextResolver = {
      resolve: async () => ({
        kind: "unauthenticated",
        reason: "invalid_credentials",
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
      const projectsResponse = await fetch(`${baseUrl}/project-library/projects`);
      expect(projectsResponse.status).toBe(401);
      await expect(projectsResponse.json()).resolves.toEqual({
        kind: "project_library_sign_in_required",
        status: "unauthenticated",
        reason: "invalid_credentials",
        message:
          "Sign in is required before account-owned saved projects can appear here.",
      });

      const historyResponse = await fetch(`${baseUrl}/project-library/history`);
      expect(historyResponse.status).toBe(401);
      await expect(historyResponse.json()).resolves.toEqual({
        kind: "export_history_sign_in_required",
        status: "unauthenticated",
        reason: "invalid_credentials",
        message:
          "Sign in is required before verified backend export history can appear here.",
      });
    } finally {
      await stopServer(server);
    }
  });

  test("selected project history routes return honest unavailable and workspace-required responses", async () => {
    const unavailableServer = await startServer({
      kind: "auth_provider_not_configured",
      reason: "missing_provider",
    });

    try {
      const response = await fetch(
        `${unavailableServer.baseUrl}/project-library/projects`,
      );
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        kind: "project_library_unavailable",
        status: "auth_not_configured",
        message: "Authentication is not configured on this backend yet.",
      });
    } finally {
      await stopServer(unavailableServer.server);
    }

    const routeAccessResolver: AsyncBackendRequesterContextResolver = {
      resolve: async () => ({
        kind: "authenticated",
        userId: "app-user-001",
        appUserId: "app-user-001",
        supabaseUserId: "supabase-user-001",
        authProvider: "supabase",
        authSubject: "supabase-user-001",
        workspaceAuthority: "not_available",
        workspaceAuthorityReason: "no_active_workspace_membership",
      }),
    };
    const workspaceRequiredServer = await startServer(
      {
        kind: "auth_provider_configured",
        provider: "future_jwt_provider",
        issuer: "https://issuer.example.test/auth/v1",
        audience: "authenticated",
      },
      routeAccessResolver,
    );

    try {
      const response = await fetch(
        `${workspaceRequiredServer.baseUrl}/project-library/history`,
      );
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        kind: "export_history_forbidden",
        status: "workspace_required",
        message:
          "A verified workspace is required before this protected route can continue.",
      });
    } finally {
      await stopServer(workspaceRequiredServer.server);
    }
  });
});
