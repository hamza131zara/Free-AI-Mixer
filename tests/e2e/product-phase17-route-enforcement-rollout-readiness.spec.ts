import { expect, test } from "@playwright/test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { resolveRouteEnforcementReadiness } from "../../backend/auth/routeEnforcementReadiness";
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

test.describe("product phase 17 route enforcement rollout readiness", () => {
  test("route enforcement plan stays readiness only while classifying public and protected families", () => {
    const decision = resolveRouteEnforcementReadiness();

    expect(decision.kind).toBe("route_enforcement_rollout_planned");
    expect(decision.liveRouteGuardRolloutEnabled).toBe(false);
    expect(decision.routeFamilies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          family: "public_read_only",
          paths: expect.arrayContaining(["/provider-settings/catalog", "/cards/catalog"]),
        }),
        expect.objectContaining({
          family: "auth_required",
          paths: expect.arrayContaining(["/auth/session", "/credits/status"]),
        }),
        expect.objectContaining({
          family: "platform_admin_required",
          paths: expect.arrayContaining(["/admin/status"]),
        }),
      ]),
    );
  });

  test("public routes remain public and protected routes still fail closed even with spoofed headers", async () => {
    const { server, baseUrl } = await startServer();

    try {
      for (const endpoint of [
        "/billing/plans",
        "/credits/policy",
        "/provider-settings/catalog",
        "/provider-settings/connections",
        "/provider-settings/routing-policy",
      ]) {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          headers: {
            "x-user-id": "spoof-user",
            "x-workspace-id": "spoof-workspace",
          },
        });

        expect(response.status).toBe(200);
      }

      for (const endpoint of ["/auth/session", "/provider-settings/status", "/credits/status"]) {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          headers: {
            "x-user-id": "spoof-user",
            "x-workspace-id": "spoof-workspace",
          },
        });

        expect([401, 503]).toContain(response.status);
      }
    } finally {
      await stopServer(server);
    }
  });
});
