import { expect, test } from "@playwright/test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
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

test.describe("product phase 18 admin privacy and security boundary", () => {
  test("admin readiness and analytics responses do not expose secrets or prompt content", async () => {
    const { server, baseUrl } = await startServer();

    try {
      for (const endpoint of ["/admin/readiness", "/admin/analytics/errors"]) {
        const response = await fetch(`${baseUrl}${endpoint}`);
        const bodyText = await response.text();

        expect(bodyText).not.toContain("service_role");
        expect(bodyText).not.toContain("Bearer ");
        expect(bodyText).not.toContain("sk-");
        expect(bodyText).not.toContain("prompt");
        expect(bodyText).not.toContain("cookie");
      }
    } finally {
      await stopServer(server);
    }
  });

  test("frontend admin code does not use localStorage as an analytics source", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/pages/AdminPage.tsx"),
      "utf8",
    ) + "\n" + readFileSync(
      path.join(process.cwd(), "src/services/adminReadinessService.ts"),
      "utf8",
    );

    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("service_role");
  });
});
