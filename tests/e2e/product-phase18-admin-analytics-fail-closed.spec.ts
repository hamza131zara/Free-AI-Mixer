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

test.describe("product phase 18 admin analytics fail-closed", () => {
  test("admin analytics routes fail closed without verified platform admin", async () => {
    const { server, baseUrl } = await startServer();

    try {
      for (const endpoint of [
        "/admin/analytics/overview",
        "/admin/analytics/users",
        "/admin/analytics/providers",
        "/admin/analytics/billing",
      ]) {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          headers: {
            "x-user-id": "spoof-admin",
            "x-workspace-id": "spoof-workspace",
          },
        });
        const payload = await response.json();

        expect([401, 403, 503]).toContain(response.status);
        expect(payload).toMatchObject({
          kind: "admin_analytics_unavailable",
          noindexRequired: true,
          verifiedAdminSessionRequired: true,
          platformAdminRoleRequired: true,
          liveMetricsEnabled: false,
          fakeMetricsAllowed: false,
        });
        expect(JSON.stringify(payload)).not.toContain("spoof-admin");
        expect(JSON.stringify(payload)).not.toContain("spoof-workspace");
      }
    } finally {
      await stopServer(server);
    }
  });
});
