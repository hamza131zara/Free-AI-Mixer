import { expect, test } from "@playwright/test";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../../backend/app";
import { createProviderSettingsRouter } from "../../backend/routes/providerSettings";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";

const authConfiguredRuntime = {
  kind: "auth_provider_configured" as const,
  provider: "future_session_provider" as const,
};

const startServer = async (app = createApp()): Promise<{ server: Server; baseUrl: string }> => {
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

const createAuthenticatedProviderSettingsApp = (
  role: "owner" | "admin" | "member" | "viewer",
): express.Express => {
  const app = express();
  const workspaceMembershipRepository: WorkspaceMembershipRepository = {
    getMembership: async ({ userId, workspaceId }) => ({
      kind: "member",
      membership: {
        userId,
        workspaceId,
        role,
        status: "active",
        source: "workspace_memberships",
      },
    }),
  };

  app.use(express.json());
  app.use((request, _response, next) => {
    (request as { backendRequesterContext?: unknown }).backendRequesterContext = {
      kind: "authenticated",
      userId: `user_${role}`,
      workspaceId: "workspace_alpha",
      authProvider: "session",
      authSubject: `subject_${role}`,
    };
    next();
  });
  app.use(
    createProviderSettingsRouter({
      runtimeConfig: authConfiguredRuntime,
      workspaceMembershipRepository,
    }),
  );

  return app;
};

const createUnauthenticatedProviderSettingsApp = (): express.Express => {
  const app = express();

  app.use(express.json());
  app.use((request, _response, next) => {
    (request as { backendRequesterContext?: unknown }).backendRequesterContext = {
      kind: "unauthenticated",
      reason: "missing_credentials",
    };
    next();
  });
  app.use(
    createProviderSettingsRouter({
      runtimeConfig: authConfiguredRuntime,
    }),
  );

  return app;
};

test.describe("product phase 15 provider settings mutation fail-closed boundary", () => {
  test("auth_not_configured provider mutation fails closed on the default app", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/provider-settings/connections`, {
        method: "POST",
      });
      expect(response.status).toBe(503);
      const body = (await response.json()) as { kind: string; status: string };
      expect(body.kind).toBe("provider_settings_mutation_unavailable");
      expect(body.status).toBe("auth_not_configured");
    } finally {
      await stopServer(server);
    }
  });

  test("unauthenticated provider mutation fails closed when auth is configured but no requester identity exists", async () => {
    const { server, baseUrl } = await startServer(
      createUnauthenticatedProviderSettingsApp(),
    );

    try {
      const response = await fetch(`${baseUrl}/provider-settings/connections`, {
        method: "POST",
      });
      expect(response.status).toBe(401);
      const body = (await response.json()) as { kind: string; status: string };
      expect(body.kind).toBe("provider_settings_sign_in_required");
      expect(body.status).toBe("unauthenticated");
    } finally {
      await stopServer(server);
    }
  });

  test("trusted x-user-id and x-workspace-id headers are not accepted as proof", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const rawSecret = "sk-proj-header-spoof-attempt";
      const response = await fetch(`${baseUrl}/provider-settings/connections`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "spoofed-user",
          "x-workspace-id": "spoofed-workspace",
        },
        body: JSON.stringify({
          providerId: "openai",
          apiKey: rawSecret,
        }),
      });

      expect([401, 503]).toContain(response.status);
      const responseText = await response.text();
      expect(responseText).not.toContain(rawSecret);
      expect(responseText).not.toContain("spoofed-user");
      expect(responseText).not.toContain("spoofed-workspace");
    } finally {
      await stopServer(server);
    }
  });

  test("workspace member and viewer cannot mutate provider keys", async () => {
    for (const role of ["member", "viewer"] as const) {
      const { server, baseUrl } = await startServer(
        createAuthenticatedProviderSettingsApp(role),
      );

      try {
        const response = await fetch(`${baseUrl}/provider-settings/connections/openai/test`, {
          method: "POST",
        });
        expect(response.status).toBe(403);
        const body = (await response.json()) as {
          kind: string;
          status: string;
          message: string;
        };
        expect(body.kind).toBe("provider_settings_forbidden");
        expect(body.status).toBe("workspace_owner_or_admin_required");
      } finally {
        await stopServer(server);
      }
    }
  });

  test("workspace owner and admin pass authorization but still fail closed because vault storage is not configured", async () => {
    for (const role of ["owner", "admin"] as const) {
      const { server, baseUrl } = await startServer(
        createAuthenticatedProviderSettingsApp(role),
      );

      try {
        const response = await fetch(`${baseUrl}/provider-settings/connections`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            providerId: "openai",
            apiKey: "sk-proj-owner-should-not-be-stored",
          }),
        });

        expect(response.status).toBe(503);
        const body = (await response.json()) as {
          kind: string;
          status: string;
          message: string;
        };
        expect(body.kind).toBe("provider_settings_mutation_unavailable");
        expect(body.status).toBe("secure_provider_key_storage_not_enabled");
      } finally {
        await stopServer(server);
      }
    }
  });

  test("provider connection metadata remains safe and does not expose secrets or balances", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/provider-settings/connections`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        kind: string;
        connections: Array<Record<string, unknown>>;
      };
      expect(body.kind).toBe("provider_settings_connections");
      expect(body.connections.length).toBeGreaterThan(0);
      expect(body.connections[0]).not.toHaveProperty("apiKey");
      expect(body.connections[0]).not.toHaveProperty("encryptedPayload");
      expect(body.connections[0]).not.toHaveProperty("providerBalance");
      expect(JSON.stringify(body)).not.toContain("sk-");
    } finally {
      await stopServer(server);
    }
  });
});
