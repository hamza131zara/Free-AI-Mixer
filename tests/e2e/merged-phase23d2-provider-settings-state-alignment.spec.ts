import { expect, test } from "@playwright/test";

const authenticatedSession = {
  kind: "authenticated_session",
  status: "authenticated",
  message: "Backend session verified.",
  identity: {
    userId: "verified-provider-user",
    workspaceId: "workspace-provider",
    authProvider: "supabase",
    authSubject: "verified-provider-user",
  },
};

test.describe("merged phase 23D-2 provider settings state alignment", () => {
  test("provider settings shows auth shell and page-level workspace-required and unavailable states honestly", async ({
    page,
  }) => {
    await page.route("**/auth/session", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "auth_unavailable",
          status: "auth_not_configured",
          message: "Authentication is not configured on this backend yet.",
        }),
      });
    });

    await page.goto("/settings/providers", { waitUntil: "load" });
    await expect(page.getByTestId("protected-route-shell")).toBeVisible();
    await expect(page.getByTestId("provider-settings-page")).toHaveCount(0);

    await page.unroute("**/auth/session");
    await page.route("**/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(authenticatedSession),
      });
    });

    await page.route("**/provider-settings/status", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "provider_settings_access_required",
          status: "workspace_required",
          message: "Workspace access is required before this page can show backend-owned data.",
        }),
      });
    });

    await page.route("**/provider-settings/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "provider_catalog",
          message: "Supported providers are listed below.",
          providers: [],
        }),
      });
    });

    await page.route("**/provider-settings/connections", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "provider_settings_connections",
          message: "Provider connection summaries remain metadata-only.",
          connections: [],
        }),
      });
    });

    await page.route("**/provider-settings/routing-policy", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "provider_settings_routing_policy",
          message: "Routing policy remains metadata-only.",
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

    await page.reload({ waitUntil: "load" });
    await expect(page.getByTestId("protected-route-shell")).toHaveCount(0);
    await expect(page.getByTestId("provider-settings-access-state")).toContainText("forbidden");
    await expect(page.getByTestId("provider-settings-access-state")).toContainText(
      "Workspace access is required before this page can show backend-owned data.",
    );

    await page.unroute("**/provider-settings/status");
    await page.route("**/provider-settings/status", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "provider_settings_unavailable",
          status: "workspace_runtime_not_configured",
          message: "Workspace authority is not configured on this backend yet.",
        }),
      });
    });

    await page.reload({ waitUntil: "load" });
    await expect(page.getByTestId("provider-settings-access-state")).toContainText("unavailable");
    await expect(page.getByTestId("provider-settings-access-state")).toContainText(
      "Workspace authority is not configured on this backend yet.",
    );
  });
});
