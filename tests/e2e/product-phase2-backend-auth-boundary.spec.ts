import { expect, test } from "@playwright/test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createApp } from "../../backend/app";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const startServer = async (): Promise<{ server: Server; baseUrl: string }> => {
  const app = createApp();
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

test.describe("product phase 2 backend auth boundary", () => {
  test("auth session and mutations fail closed when no real provider is configured", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const sessionResponse = await fetch(`${baseUrl}/auth/session`);
      expect(sessionResponse.status).toBe(503);
      await expect(sessionResponse.json()).resolves.toEqual({
        kind: "auth_unavailable",
        status: "auth_not_configured",
        message: "Authentication is not configured on this backend yet.",
      });

      for (const endpoint of ["/auth/login", "/auth/signup", "/auth/logout"]) {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "user@example.com",
            password: "secret",
          }),
        });

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({
          kind: "auth_unavailable",
          status: "auth_not_configured",
          message: "Authentication is not configured on this backend yet.",
        });
      }
    } finally {
      await stopServer(server);
    }
  });

  test("auth session does not trust x-user-id or x-workspace-id shortcuts", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/auth/session`, {
        headers: {
          "x-user-id": "fake-user-must-not-authenticate",
          "x-workspace-id": "fake-workspace-must-not-authenticate",
          cookie: "fake-session=must-not-authenticate",
        },
      });

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        kind: "auth_unavailable",
        status: "auth_not_configured",
        message: "Authentication is not configured on this backend yet.",
      });
    } finally {
      await stopServer(server);
    }
  });

  test("source boundaries still avoid trusted header and service-role shortcuts", async () => {
    const combinedSource = [
      readSource("backend/routes/auth.ts"),
      readSource("backend/auth/trustedAuthMiddleware.ts"),
      readSource("backend/auth/trustedAuthProviderComposition.ts"),
      readSource("backend/routes/exports.ts"),
      readSource("src/services/authService.ts"),
      readSource("src/store/authStore.ts"),
    ].join("\n");

    expect(combinedSource).not.toContain('req.headers["x-user-id"]');
    expect(combinedSource).not.toContain('req.headers["x-workspace-id"]');
    expect(combinedSource).not.toContain("x-user-id");
    expect(combinedSource).not.toContain("x-workspace-id");
    expect(combinedSource).not.toContain("service_role");
    expect(combinedSource).not.toContain("SERVICE_ROLE");
    expect(combinedSource).not.toContain("@supabase/supabase-js");
  });
});
