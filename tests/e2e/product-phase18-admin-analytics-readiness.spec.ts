import { expect, test } from "@playwright/test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { resolveAdminAnalyticsReadiness } from "../../backend/admin/adminAnalyticsReadiness";
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

test.describe("product phase 18 admin analytics readiness", () => {
  test("admin analytics readiness contract exists and is readiness-only", () => {
    const readiness = resolveAdminAnalyticsReadiness();

    expect(readiness).toMatchObject({
      kind: "admin_analytics_readiness",
      liveAnalyticsEnabled: false,
      fakeMetricsAllowed: false,
      platformAdminRequiredLater: true,
    });
    expect(readiness.indicators.length).toBeGreaterThan(5);
    expect(readiness.indicators.every((indicator) => indicator.safeNow)).toBe(true);
    expect(readiness.indicators.every((indicator) => indicator.label === "Readiness indicator")).toBe(true);
  });

  test("admin readiness route stays fail-closed while exposing only readiness data", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/admin/readiness`);
      const payload = await response.json();

      expect([401, 403, 503]).toContain(response.status);
      expect(payload).toMatchObject({
        kind: "admin_readiness",
        noindexRequired: true,
        verifiedAdminSessionRequired: true,
        platformRolesConfigured: false,
        analyticsReadiness: {
          kind: "admin_analytics_readiness",
          liveAnalyticsEnabled: false,
          fakeMetricsAllowed: false,
        },
        metricCatalog: {
          kind: "admin_metric_catalog",
          liveMetricsEnabled: false,
          fakeMetricsAllowed: false,
        },
      });
      expect(JSON.stringify(payload)).not.toContain("totalUsers");
      expect(JSON.stringify(payload)).not.toContain("Revenue: $");
    } finally {
      await stopServer(server);
    }
  });
});
