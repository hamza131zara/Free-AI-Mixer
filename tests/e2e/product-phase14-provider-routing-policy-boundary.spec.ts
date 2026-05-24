import { expect, test } from "@playwright/test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createApp } from "../../backend/app";
import { chooseGenerationProvider } from "../../backend/generation/generationRouting";

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

test.describe("product phase 14 provider routing policy boundary", () => {
  test("routing policy endpoint stays read-only and advertises manual priority auto plus opt-in fallback", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/provider-settings/routing-policy`);
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        kind: string;
        routingPreferences: {
          mode: string;
          recommendedVideoPriority: string[];
          recommendedImagePriority: string[];
          fallback: { enabled: boolean; requiresExplicitOptIn: boolean };
        };
      };

      expect(body.kind).toBe("provider_settings_routing_policy");
      expect(body.routingPreferences.mode).toBe("auto");
      expect(body.routingPreferences.fallback.enabled).toBe(false);
      expect(body.routingPreferences.fallback.requiresExplicitOptIn).toBe(true);
      expect(body.routingPreferences.recommendedVideoPriority).toEqual([
        "runway",
        "luma",
        "google",
        "openai",
        "replicate",
      ]);
      expect(body.routingPreferences.recommendedImagePriority).toEqual([
        "openai",
        "stability",
        "google",
        "replicate",
      ]);
    } finally {
      await stopServer(server);
    }
  });

  test("generation routing still selects one provider per attempt and keeps fallback opt-in only", () => {
    const decision = chooseGenerationProvider({
      availableProviderIds: ["runway", "luma", "google", "openai", "replicate"],
      preferences: {
        mode: "manual",
        manualProviderId: "luma",
        recommendedVideoPriority: ["runway", "luma", "google", "openai", "replicate"],
        recommendedImagePriority: ["openai", "stability", "google", "replicate"],
        fallback: {
          enabled: false,
          orderedProviderIds: ["runway", "google", "replicate"],
          requiresExplicitOptIn: true,
        },
      },
    });

    expect(decision.selectedProviderId).toBe("luma");
    expect(decision.selectsSingleProviderPerAttempt).toBe(true);
    expect(decision.fallbackEnabled).toBe(false);
    expect(decision.orderedFallbackProviderIds).toEqual([]);
  });

  test("routing boundary source does not fan out across all providers or trust auth header shortcuts", () => {
    const combinedSource = [
      readSource("backend/routes/providerSettings.ts"),
      readSource("backend/generation/generationRouting.ts"),
      readSource("backend/generation/generationProviderTypes.ts"),
    ].join("\n");

    expect(combinedSource).not.toContain('req.headers["x-user-id"]');
    expect(combinedSource).not.toContain('req.headers["x-workspace-id"]');
    expect(combinedSource).not.toContain("Promise.all([\"openai\"");
    expect(combinedSource).not.toContain("fanout");
  });
});
