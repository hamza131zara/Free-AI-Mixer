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

test.describe("product phase 16 trusted header spoofing regression", () => {
  test("auth session protected routes and provider settings ignore x-user-id and x-workspace-id headers", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const headers = {
        "x-user-id": "spoof-user",
        "x-workspace-id": "spoof-workspace",
        authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.signature",
        cookie: "session_token=fake-session-value",
      };

      const authSession = await fetch(`${baseUrl}/auth/session`, { headers });
      expect(authSession.status).toBe(503);
      const authText = await authSession.text();
      expect(authText).not.toContain("spoof-user");
      expect(authText).not.toContain("spoof-workspace");
      expect(authText).not.toContain("fake-session-value");

      const providerMutation = await fetch(`${baseUrl}/provider-settings/connections`, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          providerId: "openai",
          apiKey: "sk-proj-spoof-secret",
        }),
      });
      expect(providerMutation.status).toBe(503);
      const providerText = await providerMutation.text();
      expect(providerText).not.toContain("spoof-user");
      expect(providerText).not.toContain("spoof-workspace");
      expect(providerText).not.toContain("sk-proj-spoof-secret");

      const creditsStatus = await fetch(`${baseUrl}/credits/status`, { headers });
      expect(creditsStatus.status).toBe(503);
      const creditsText = await creditsStatus.text();
      expect(creditsText).not.toContain("spoof-user");
      expect(creditsText).not.toContain("spoof-workspace");
    } finally {
      await stopServer(server);
    }
  });
});
