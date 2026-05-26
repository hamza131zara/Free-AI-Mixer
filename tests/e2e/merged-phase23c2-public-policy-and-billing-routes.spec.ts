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

test.describe("merged phase 23C-2 public policy and billing routes", () => {
  test("/credits/policy and /billing/plans remain public", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const creditsPolicyResponse = await fetch(`${baseUrl}/credits/policy`);
      expect(creditsPolicyResponse.status).toBe(200);
      await expect(creditsPolicyResponse.json()).resolves.toMatchObject({
        kind: "credits_policy",
      });

      const billingPlansResponse = await fetch(`${baseUrl}/billing/plans`);
      expect(billingPlansResponse.status).toBe(200);
      await expect(billingPlansResponse.json()).resolves.toMatchObject({
        kind: "billing_plans",
      });
    } finally {
      await stopServer(server);
    }
  });
});
