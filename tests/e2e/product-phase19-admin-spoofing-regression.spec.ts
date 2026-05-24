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

test.describe("product phase 19 admin spoofing regression", () => {
  test("trusted headers and fake bearer values cannot spoof platform admin", async () => {
    const { server, baseUrl } = await startServer();

    try {
      for (const endpoint of [
        "/admin/status",
        "/admin/readiness",
        "/admin/analytics/overview",
      ]) {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          headers: {
            authorization: "Bearer fake.platform.admin.token",
            cookie: "session=fake-admin-session",
            "x-user-id": "spoof-platform-admin",
            "x-workspace-id": "spoof-workspace",
          },
        });
        const payload = await response.json();
        const serialized = JSON.stringify(payload);

        expect([401, 403, 503]).toContain(response.status);
        expect(serialized).not.toContain("spoof-platform-admin");
        expect(serialized).not.toContain("spoof-workspace");
        expect(serialized).not.toContain("fake.platform.admin.token");
        expect(serialized).not.toContain("fake-admin-session");
      }
    } finally {
      await stopServer(server);
    }
  });
});
