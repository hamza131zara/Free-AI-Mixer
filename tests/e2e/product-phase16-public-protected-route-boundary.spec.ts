import { expect, test } from "@playwright/test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../../backend/app";

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

test.describe("product phase 16 public and protected route boundary", () => {
  test("public routes remain public and read-only", async () => {
    const { server, baseUrl } = await startServer();

    try {
      for (const endpoint of [
        "/billing/plans",
        "/credits/policy",
        "/provider-settings/catalog",
        "/provider-settings/connections",
        "/provider-settings/routing-policy",
        "/cards/catalog",
        "/ai-tools/catalog",
        "/ai-news/feed",
      ]) {
        const response = await fetch(`${baseUrl}${endpoint}`);
        expect(response.status).toBe(200);
      }
    } finally {
      await stopServer(server);
    }
  });

  test("protected routes fail closed when auth is not configured", async () => {
    const { server, baseUrl } = await startServer();

    try {
      for (const endpoint of [
        "/auth/session",
        "/provider-settings/status",
        "/project-library/projects",
        "/project-library/history",
        "/credits/status",
      ]) {
        const response = await fetch(`${baseUrl}${endpoint}`);
        expect([401, 503]).toContain(response.status);
      }
    } finally {
      await stopServer(server);
    }
  });
});
