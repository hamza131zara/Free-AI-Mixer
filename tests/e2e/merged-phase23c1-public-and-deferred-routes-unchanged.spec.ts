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

test.describe("merged phase 23C-1 public and deferred routes unchanged", () => {
  test("public routes stay public and deferred routes keep prior boundaries", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const healthResponse = await fetch(`${baseUrl}/monitoring/health`);
      expect(healthResponse.status).toBe(200);

      const readinessResponse = await fetch(`${baseUrl}/monitoring/readiness`);
      expect(readinessResponse.status).toBe(200);

      const billingPlansResponse = await fetch(`${baseUrl}/billing/plans`);
      expect(billingPlansResponse.status).toBe(200);

      const creditsStatusResponse = await fetch(`${baseUrl}/credits/status`);
      expect([401, 503]).toContain(creditsStatusResponse.status);

      const adminStatusResponse = await fetch(`${baseUrl}/admin/status`);
      expect([401, 403, 503]).toContain(adminStatusResponse.status);
    } finally {
      await stopServer(server);
    }
  });

  test("credits generation exports admin and billing route sources remain free of 23C-1 resolver wiring", () => {
    const deferredSources = [
      readSource("backend/routes/credits.ts"),
      readSource("backend/routes/generation.ts"),
      readSource("backend/routes/exports.ts"),
      readSource("backend/routes/admin.ts"),
      readSource("backend/routes/billing.ts"),
    ].join("\n");

    expect(deferredSources).not.toContain("routeAccessResolver");
    expect(deferredSources).not.toContain("resolveSelectedRouteAccess(");
    expect(deferredSources).not.toContain("workspace_runtime_not_configured");
  });
});
