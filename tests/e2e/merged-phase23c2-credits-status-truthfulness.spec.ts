import { expect, test } from "@playwright/test";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { AsyncBackendRequesterContextResolver } from "../../backend/auth/requesterContextResolver";
import { createCreditsRouter } from "../../backend/routes/credits";

const startServer = async (
  routeAccessResolver: AsyncBackendRequesterContextResolver,
): Promise<{ server: Server; baseUrl: string }> => {
  const app = express();
  app.use(
    createCreditsRouter({
      runtimeConfig: {
        kind: "auth_provider_configured",
        provider: "future_jwt_provider",
        issuer: "https://issuer.example.test/auth/v1",
        audience: "authenticated",
      },
      routeAccessResolver,
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

test.describe("merged phase 23C-2 credits status truthfulness", () => {
  test("verified workspace authority returns truthful non-live credits status only", async () => {
    const routeAccessResolver: AsyncBackendRequesterContextResolver = {
      resolve: async () => ({
        kind: "authenticated",
        userId: "app-user-credits-verified",
        appUserId: "app-user-credits-verified",
        supabaseUserId: "supabase-user-credits-verified",
        authProvider: "supabase",
        authSubject: "supabase-user-credits-verified",
        workspaceId: "workspace-credits-verified",
        workspaceRole: "workspace_admin",
        workspaceAuthority: "verified",
      }),
    };

    const { server, baseUrl } = await startServer(routeAccessResolver);

    try {
      const response = await fetch(`${baseUrl}/credits/status`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        kind: string;
        status: string;
        wallet: {
          state: string;
          scope: string;
          liveBalanceAvailable: boolean;
          message: string;
          activeWorkspaceId?: string;
          balance?: unknown;
          subscription?: unknown;
          purchases?: unknown;
          ledger?: unknown;
        };
      };

      expect(body.kind).toBe("credits_status");
      expect(body.status).toBe("authenticated");
      expect(body.wallet.state).toBe("platform_credits_not_configured");
      expect(body.wallet.scope).toBe("workspace");
      expect(body.wallet.liveBalanceAvailable).toBe(false);
      expect(body.wallet.activeWorkspaceId).toBe("workspace-credits-verified");
      expect(body.wallet).not.toHaveProperty("balance");
      expect(body.wallet).not.toHaveProperty("subscription");
      expect(body.wallet).not.toHaveProperty("purchases");
      expect(body.wallet).not.toHaveProperty("ledger");
      expect(JSON.stringify(body)).not.toContain("checkout");
      expect(JSON.stringify(body)).not.toContain("webhook");
    } finally {
      await stopServer(server);
    }
  });
});
