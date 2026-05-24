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

test.describe("product phase 17 admin analytics prerequisite", () => {
  test("roadmap keeps admin analytics as a future readiness-only phase", () => {
    const roadmap = readFileSync(
      path.join(process.cwd(), "docs/roadmap.md"),
      "utf8",
    );

    expect(roadmap).toContain("Phase 18 Recommendation");
    expect(roadmap).toContain("Admin Analytics + Platform Metrics");
    expect(roadmap).toContain("Do not ship fake dashboard counts");
  });

  test("admin route stays unavailable and does not return fake metrics", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/admin/status`);
      const payload = await response.json();

      expect([401, 403, 503]).toContain(response.status);
      expect(payload).not.toHaveProperty("totalUsers");
      expect(payload).not.toHaveProperty("activeUsers");
      expect(payload).not.toHaveProperty("workspaceCount");
      expect(payload).not.toHaveProperty("generationAttempts");
      expect(payload).toMatchObject({
        noindexRequired: true,
        verifiedAdminSessionRequired: true,
        platformRolesConfigured: false,
      });
    } finally {
      await stopServer(server);
    }
  });
});
