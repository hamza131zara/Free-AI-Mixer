import { expect, test } from "@playwright/test";

test.describe("merged phase 23D-1 backend truth preserved", () => {
  test("authenticated route shell does not swallow backend workspace-required truth", async ({
    page,
  }) => {
    await page.route("**/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "authenticated_session",
          status: "authenticated",
          message: "Backend session verified.",
          identity: {
            userId: "verified-phase23d-user",
            workspaceId: "workspace-phase23d",
            authProvider: "supabase",
            authSubject: "verified-phase23d-user",
          },
        }),
      });
    });

    await page.route("**/credits/policy", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "credits_policy",
          message: "Credit policy is available in planned-state form only.",
          policy: {
            freeByokDailyCreditsLater: 2500,
            providerCostOwner: "user_api_key",
            walletScope: "workspace",
            sharedWalletSurfaces: ["mixer", "templates", "exports", "downloads"],
            multipleApiKeysMultiplyCredits: false,
            multipleProvidersMultiplyCredits: false,
            creditsEnabled: false,
            billingEnabled: false,
            policyNotes: ["Credits and billing are not enabled yet."],
            draftEstimates: [],
          },
        }),
      });
    });

    await page.route("**/credits/status", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "credits_unavailable",
          status: "workspace_runtime_not_configured",
          message: "Workspace authority is not configured on this backend yet.",
        }),
      });
    });

    await page.goto("/credits", { waitUntil: "load" });

    await expect(page.getByTestId("protected-route-shell")).toHaveCount(0);
    await expect(page.getByTestId("credits-page")).toBeVisible();
    await expect(page.getByTestId("credits-status-card")).toContainText(
      "Workspace authority is not configured on this backend yet.",
    );
  });

  test("authenticated route shell still allows truthful non-live credit state on authorized access", async ({
    page,
  }) => {
    await page.route("**/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "authenticated_session",
          status: "authenticated",
          message: "Backend session verified.",
          identity: {
            userId: "verified-phase23d-user",
            workspaceId: "workspace-phase23d",
            authProvider: "supabase",
            authSubject: "verified-phase23d-user",
          },
        }),
      });
    });

    await page.route("**/credits/policy", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "credits_policy",
          message: "Credit policy is available in planned-state form only.",
          policy: {
            freeByokDailyCreditsLater: 2500,
            providerCostOwner: "user_api_key",
            walletScope: "workspace",
            sharedWalletSurfaces: ["mixer", "templates", "exports", "downloads"],
            multipleApiKeysMultiplyCredits: false,
            multipleProvidersMultiplyCredits: false,
            creditsEnabled: false,
            billingEnabled: false,
            policyNotes: ["Credits and billing are not enabled yet."],
            draftEstimates: [],
          },
        }),
      });
    });

    await page.route("**/credits/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "credits_status",
          status: "authenticated",
          message:
            "Credits policy is visible for this verified session, but wallet mutation is not enabled yet.",
          wallet: {
            state: "platform_credits_not_configured",
            scope: "workspace",
            liveBalanceAvailable: false,
            message: "No live credit balance is available in this product phase.",
            activeWorkspaceId: "workspace-phase23d",
          },
        }),
      });
    });

    await page.goto("/credits", { waitUntil: "load" });

    await expect(page.getByTestId("credits-page")).toBeVisible();
    await expect(page.getByTestId("credits-status-card")).toContainText(
      "No live credit balance is available in this product phase.",
    );
    await expect(page.getByTestId("credits-page")).toContainText(
      "This page only shows planned credit policy and backend-owned readiness status.",
    );
    await expect(page.getByTestId("credits-page")).toContainText(
      "It does not fabricate a balance, refill action, purchase flow, subscription, or premium entitlement.",
    );
  });
});
