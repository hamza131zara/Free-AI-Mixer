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

test.describe("product phase 4 project library and export history backend boundary", () => {
  test("project library endpoint fails closed without verified auth", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/project-library/projects`);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        kind: "project_library_unavailable",
        status: "auth_not_configured",
        message: "Authentication is not configured on this backend yet.",
      });
    } finally {
      await stopServer(server);
    }
  });

  test("export history endpoint fails closed without verified auth", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/project-library/history`);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        kind: "export_history_unavailable",
        status: "auth_not_configured",
        message: "Authentication is not configured on this backend yet.",
      });
    } finally {
      await stopServer(server);
    }
  });

  test("project and history boundaries do not trust x-user-id or x-workspace-id shortcuts", async () => {
    const { server, baseUrl } = await startServer();

    try {
      for (const endpoint of ["/project-library/projects", "/project-library/history"]) {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          headers: {
            "x-user-id": "fake-user-must-not-authenticate",
            "x-workspace-id": "fake-workspace-must-not-authenticate",
            cookie: "fake-session=must-not-authenticate",
          },
        });

        expect(response.status).toBe(503);
      }
    } finally {
      await stopServer(server);
    }
  });

  test("project history boundary source avoids trusted headers local ownership and service-role shortcuts", async () => {
    const combinedSource = [
      readSource("backend/routes/projectHistory.ts"),
      readSource("backend/contracts/projectHistoryHttpTypes.ts"),
      readSource("src/services/projectLibraryService.ts"),
      readSource("src/services/exportHistoryService.ts"),
      readSource("src/store/projectLibraryStore.ts"),
      readSource("src/store/exportHistoryStore.ts"),
      readSource("src/types/projectLibrary.ts"),
      readSource("src/types/exportHistory.ts"),
      readSource("src/pages/ProjectsPage.tsx"),
      readSource("src/pages/ExportHistoryPage.tsx"),
    ].join("\n");

    expect(combinedSource).not.toContain('req.headers["x-user-id"]');
    expect(combinedSource).not.toContain('req.headers["x-workspace-id"]');
    expect(combinedSource).not.toContain("x-user-id");
    expect(combinedSource).not.toContain("x-workspace-id");
    expect(combinedSource).not.toContain("service_role");
    expect(combinedSource).not.toContain("SERVICE_ROLE");
    expect(combinedSource).not.toContain("@supabase/supabase-js");
    expect(combinedSource).not.toContain(".storage.from(");
    expect(combinedSource).not.toContain("free-ai-mixer-export-handles");
    expect(combinedSource).not.toContain("free-ai-mixer-timelines");
    expect(combinedSource).not.toContain("localStorage.getItem");
    expect(combinedSource).not.toContain("localStorage.setItem");
  });
});
