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

test.describe("product phase 5 generation runtime boundary", () => {
  test("generation runtime boundary fails closed by default", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/generation/runtime-status`);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        kind: "generation_runtime_unavailable",
        status: "auth_not_configured",
        message: "Authentication is not configured on this backend yet.",
      });
    } finally {
      await stopServer(server);
    }
  });

  test("generation job boundary does not return fake success progress or vendor execution by default", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/generation/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: "A city skyline at dusk",
        }),
      });

      expect(response.status).toBe(503);

      const body = (await response.json()) as {
        kind: string;
        status: string;
        runtime: Record<string, unknown>;
        attemptedProviderIds: unknown[];
        progress?: unknown;
        percent?: unknown;
      };

      expect(body.kind).toBe("generation_job_rejected");
      expect(body.status).toBe("auth_not_configured");
      expect(body.runtime.executionState).toBe("disabled_by_default");
      expect(body.runtime.vendorCallsEnabled).toBe(false);
      expect(body.attemptedProviderIds).toEqual([]);
      expect(body).not.toHaveProperty("progress");
      expect(body).not.toHaveProperty("percent");
    } finally {
      await stopServer(server);
    }
  });

  test("generation runtime boundary does not trust x-user-id or x-workspace-id shortcuts", async () => {
    const { server, baseUrl } = await startServer();

    try {
      for (const [method, endpoint] of [
        ["GET", "/generation/runtime-status"],
        ["POST", "/generation/jobs"],
      ] as const) {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            "x-user-id": "fake-user-must-not-authenticate",
            "x-workspace-id": "fake-workspace-must-not-authenticate",
            cookie: "fake-session=must-not-authenticate",
          },
          ...(method === "POST"
            ? { body: JSON.stringify({ prompt: "must fail closed" }) }
            : {}),
        });

        expect(response.status).toBe(503);
      }
    } finally {
      await stopServer(server);
    }
  });

  test("generation runtime boundary source avoids vendor calls raw key storage and frontend secret shortcuts", async () => {
    const combinedSource = [
      readSource("backend/routes/generation.ts"),
      readSource("backend/contracts/generationRuntimeHttpTypes.ts"),
      readSource("backend/generation/generationProviderTypes.ts"),
      readSource("backend/generation/generationProviderAdapter.ts"),
      readSource("backend/generation/generationFailureMapping.ts"),
      readSource("backend/generation/generationAttemptMetadata.ts"),
      readSource("backend/generation/generationRouting.ts"),
    ].join("\n");

    expect(combinedSource).not.toContain('req.headers["x-user-id"]');
    expect(combinedSource).not.toContain('req.headers["x-workspace-id"]');
    expect(combinedSource).not.toContain("x-user-id");
    expect(combinedSource).not.toContain("x-workspace-id");
    expect(combinedSource).not.toContain("api.openai.com");
    expect(combinedSource).not.toContain("googleapis.com");
    expect(combinedSource).not.toContain("stability.ai");
    expect(combinedSource).not.toContain("replicate.com");
    expect(combinedSource).not.toContain("runwayml.com");
    expect(combinedSource).not.toContain("lumalabs.ai");
    expect(combinedSource).not.toContain("SERVICE_ROLE");
    expect(combinedSource).not.toContain("service_role");
    expect(combinedSource).not.toContain("localStorage.setItem");
    expect(combinedSource).not.toContain("sessionStorage.setItem");
    expect(combinedSource).not.toContain("apiKey");
    expect(combinedSource).not.toContain("rawKey");
  });
});
