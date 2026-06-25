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

test.describe("product phase 3 provider settings backend boundary", () => {
  test("provider catalog renders supported providers without external provider calls", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/provider-settings/catalog`);
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        kind: string;
        providers: Array<{ displayName: string }>;
      };

      expect(body.kind).toBe("provider_catalog");
      expect(body.providers.map((provider) => provider.displayName)).toEqual([
        "OpenAI",
        "Runway",
        "Luma",
        "Google Gemini/Veo",
        "Stability",
        "Replicate",
      ]);
    } finally {
      await stopServer(server);
    }
  });

  test("provider settings status fails closed without verified auth or provider config", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/provider-settings/status`);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        kind: "provider_settings_unavailable",
        status: "auth_not_configured",
        message: "Authentication is not configured on this backend yet.",
      });
    } finally {
      await stopServer(server);
    }
  });

  test("provider settings status does not trust x-user-id or x-workspace-id shortcuts", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/provider-settings/status`, {
        headers: {
          "x-user-id": "fake-user-must-not-authenticate",
          "x-workspace-id": "fake-workspace-must-not-authenticate",
          cookie: "fake-session=must-not-authenticate",
        },
      });

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        kind: "provider_settings_unavailable",
        status: "auth_not_configured",
        message: "Authentication is not configured on this backend yet.",
      });
    } finally {
      await stopServer(server);
    }
  });

  test("provider settings boundary source avoids trusted headers raw secrets and vendor network calls", async () => {
    const combinedSource = [
      readSource("backend/routes/providerSettings.ts"),
      readSource("backend/providers/providerCatalog.ts"),
      readSource("backend/contracts/providerSettingsHttpTypes.ts"),
      readSource("src/services/providerSettingsService.ts"),
      readSource("src/store/providerSettingsStore.ts"),
      readSource("src/types/providerSettings.ts"),
    ].join("\n");

    expect(combinedSource).not.toContain('req.headers["x-user-id"]');
    expect(combinedSource).not.toContain('req.headers["x-workspace-id"]');
    expect(combinedSource).not.toContain("x-user-id");
    expect(combinedSource).not.toContain("x-workspace-id");
    expect(combinedSource).not.toContain("api.openai.com");
    expect(combinedSource).not.toContain("googleapis.com");
    expect(combinedSource).not.toContain("api.stability.ai");
    expect(combinedSource).not.toMatch(
      /fetch\s*\(\s*["'`]https:\/\/(?:api\.)?stability\.ai/i,
    );
    expect(combinedSource).not.toContain("api.replicate.com");
    expect(combinedSource).not.toMatch(
      /fetch\s*\(\s*["'`]https:\/\//i,
    );
    expect(combinedSource).not.toContain("SERVICE_ROLE");
    expect(combinedSource).not.toContain("service_role");
    expect(combinedSource).not.toContain("localStorage.setItem");
    expect(combinedSource).not.toContain("sessionStorage.setItem");
  });
});
