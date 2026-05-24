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

test.describe("product phase 14 provider settings security boundary", () => {
  test("connection mutation and test endpoints fail closed when secure storage is not enabled", async () => {
    const { server, baseUrl } = await startServer();

    try {
      for (const request of [
        {
          url: `${baseUrl}/provider-settings/connections`,
          method: "POST",
        },
        {
          url: `${baseUrl}/provider-settings/connections/openai`,
          method: "DELETE",
        },
        {
          url: `${baseUrl}/provider-settings/connections/openai/test`,
          method: "POST",
        },
      ] as const) {
        const response = await fetch(request.url, { method: request.method });
        expect([401, 503]).toContain(response.status);
        const body = (await response.json()) as { kind: string; message: string };
        expect(
          body.kind === "provider_settings_mutation_unavailable" ||
            body.kind === "provider_settings_sign_in_required",
        ).toBe(true);
      }
    } finally {
      await stopServer(server);
    }
  });

  test("provider settings source avoids API key persistence, frontend storage, and raw secrets", async () => {
    const combinedSource = [
      readSource("src/pages/ProviderSettingsPage.tsx"),
      readSource("src/services/providerSettingsService.ts"),
      readSource("src/store/providerSettingsStore.ts"),
      readSource("src/types/providerSettings.ts"),
      readSource("backend/routes/providerSettings.ts"),
      readSource("backend/contracts/providerSettingsHttpTypes.ts"),
    ].join("\n");

    expect(combinedSource).not.toContain("localStorage.setItem");
    expect(combinedSource).not.toContain("sessionStorage.setItem");
    expect(combinedSource).not.toContain("api.openai.com");
    expect(combinedSource).not.toContain("googleapis.com");
    expect(combinedSource).not.toContain("stability.ai");
    expect(combinedSource).not.toContain("replicate.com");
    expect(combinedSource).not.toContain("SERVICE_ROLE");
    expect(combinedSource).not.toContain("service_role");
    expect(combinedSource).not.toContain("maskedKeySummary: \"sk-");
    expect(combinedSource).not.toContain("input type=\"password\"");
  });

  test("provider settings page exposes disabled readiness actions and no raw key field", async ({ page }) => {
    await page.route("**/provider-settings/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "provider_catalog",
          message: "Supported BYOK providers are listed.",
          providers: [
            {
              id: "openai",
              displayName: "OpenAI",
              capabilities: ["image_generation", "image_editing", "template_generation_candidate", "card_generation_candidate", "prompt_text_intelligence"],
              supportsByok: true,
              summary: "General-purpose provider.",
              officialWebsite: "https://openai.com",
              docsUrl: "https://platform.openai.com/docs",
              securityNote: "API keys must remain backend-managed later.",
              costNote: "User provider balance later.",
              platformLimitNote: "Platform credits remain separate.",
              status: "available",
            },
          ],
        }),
      });
    });
    await page.route("**/provider-settings/status", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "provider_settings_unavailable",
          status: "auth_not_configured",
          message: "Authentication is not configured on this backend yet.",
        }),
      });
    });
    await page.route("**/provider-settings/connections", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "provider_settings_connections",
          message: "Connection summaries remain read-only.",
          connections: [
            {
              providerId: "openai",
              status: "not_connected",
              maskedKeySummary: "Secure API key connection is not enabled yet.",
              lastValidationStatus: "not_enabled_yet",
            },
          ],
        }),
      });
    });
    await page.route("**/provider-settings/routing-policy", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "provider_settings_routing_policy",
          message: "Routing policy metadata only.",
          routingPreferences: {
            mode: "auto",
            recommendedVideoPriority: ["runway", "luma", "google", "openai", "replicate"],
            recommendedImagePriority: ["openai", "stability", "google", "replicate"],
            fallback: {
              enabled: false,
              orderedProviderIds: [],
              requiresExplicitOptIn: true,
            },
          },
        }),
      });
    });

    await page.goto("/settings/providers", { waitUntil: "load" });

    for (const actionName of ["Add key", "Replace key", "Remove key", "Test connection"]) {
      await expect(page.getByRole("button", { name: actionName }).first()).toBeDisabled();
    }

    await expect(page.locator("input")).toHaveCount(0);
    await expect(page.locator("textarea")).toHaveCount(0);
  });
});
