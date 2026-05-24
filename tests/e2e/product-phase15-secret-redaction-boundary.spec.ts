import { expect, test } from "@playwright/test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../../backend/app";
import { createSafeStructuredLogEvent } from "../../backend/observability/safeStructuredLogger";

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

test.describe("product phase 15 secret redaction boundary", () => {
  test("structured logger redacts api-key-shaped values and sensitive fields", () => {
    const event = createSafeStructuredLogEvent({
      event: "provider.settings.boundary",
      severity: "warn",
      metadata: {
        apiKey: "sk-proj-phase15-sensitive",
        api_key: "sk-phase15-sensitive",
        authorization: "Bearer sk-auth-sensitive",
        token: "rw_phase15_token",
        secret: "replicate-phase15-secret",
        nested: {
          providerPath: "C:\\provider\\keys\\secret.txt",
          signedUrl: "https://example.com/file.png?X-Amz-Signature=secret-value",
        },
      },
    });

    const serializedEvent = JSON.stringify(event);

    expect(serializedEvent).not.toContain("sk-proj-phase15-sensitive");
    expect(serializedEvent).not.toContain("sk-phase15-sensitive");
    expect(serializedEvent).not.toContain("sk-auth-sensitive");
    expect(serializedEvent).not.toContain("rw_phase15_token");
    expect(serializedEvent).not.toContain("replicate-phase15-secret");
    expect(serializedEvent).not.toContain("C:\\provider\\keys\\secret.txt");
    expect(serializedEvent).not.toContain("X-Amz-Signature=secret-value");
    expect(event.redactedFields).toEqual(
      expect.arrayContaining([
        "apiKey",
        "api_key",
        "authorization",
        "token",
        "secret",
        "nested.providerPath",
        "nested.signedUrl",
      ]),
    );
  });

  test("provider settings mutation responses never echo raw API keys", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const rawSecret = "sk-proj-phase15-response-secret";
      const response = await fetch(`${baseUrl}/provider-settings/connections`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          providerId: "openai",
          apiKey: rawSecret,
          token: "rw_phase15_token",
        }),
      });

      const text = await response.text();
      expect(text).not.toContain(rawSecret);
      expect(text).not.toContain("rw_phase15_token");
    } finally {
      await stopServer(server);
    }
  });
});
