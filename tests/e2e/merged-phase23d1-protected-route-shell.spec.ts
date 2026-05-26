import { expect, test } from "@playwright/test";

test.describe("merged phase 23D-1 protected route shell", () => {
  test("protected shell shows checking state while backend session is still resolving", async ({
    page,
  }) => {
    let releaseSessionResponse: (() => void) | undefined;
    const sessionResponseReleased = new Promise<void>((resolve) => {
      releaseSessionResponse = resolve;
    });

    await page.route("**/auth/session", async (route) => {
      await sessionResponseReleased;
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

    await page.goto("/projects", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("protected-route-shell")).toBeVisible();
    await expect(page.getByTestId("protected-route-shell-status")).toContainText(
      "Checking backend session status.",
    );

    releaseSessionResponse?.();

    await expect(page.getByTestId("protected-route-shell-status")).toContainText(
      "Authentication is not configured on this backend yet.",
    );
  });

  test("unauthenticated protected pages show a sign-in shell with no fake private data", async ({
    page,
  }) => {
    await page.route("**/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "unauthenticated_session",
          status: "unauthenticated",
          reason: "missing_credentials",
          message: "Sign in is required before protected account routes can show verified data.",
        }),
      });
    });

    await page.goto("/credits", { waitUntil: "load" });

    await expect(page.getByTestId("protected-route-shell")).toBeVisible();
    await expect(page.getByTestId("protected-route-shell-status")).toContainText(
      "Sign in is required before this page can show verified account data.",
    );
    await expect(page.getByRole("button", { name: "Go to login" })).toBeVisible();
    await expect(page.getByTestId("credits-page")).toHaveCount(0);
    await expect(page.getByText("No fake user or local-only login")).toHaveCount(0);
  });

  test("authenticated protected pages render and let backend-owned page truth continue", async ({
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

    await page.route("**/credits/status", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "credits_access_required",
          status: "workspace_required",
          message: "Workspace access is required before this page can show backend-owned data.",
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

    await page.goto("/credits", { waitUntil: "load" });

    await expect(page.getByTestId("protected-route-shell")).toHaveCount(0);
    await expect(page.getByTestId("credits-page")).toBeVisible();
    await expect(page.getByTestId("credits-status-card")).toContainText(
      "Workspace access is required before this page can show backend-owned data.",
    );
  });
});
