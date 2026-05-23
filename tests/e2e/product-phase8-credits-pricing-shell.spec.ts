import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const listFrontendSourceFiles = (directory: string): string[] => {
  const fullPath = path.join(projectRoot, directory);
  const entries = readdirSync(fullPath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const relativePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listFrontendSourceFiles(relativePath);
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      return [relativePath];
    }

    return [];
  });
};

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("product phase 8 credits and pricing shell", () => {
  test("credits page renders honest planned policy without fake balance", async ({ page }) => {
    await page.route("**/credits/policy", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "credits_policy",
          message: "Credits policy is available in planning-only form. No balances, purchases, or mutations are enabled.",
          policy: {
            freeByokDailyCreditsLater: 2500,
            providerCostOwner: "user_api_key",
            walletScope: "workspace",
            sharedWalletSurfaces: ["mixer", "templates", "exports", "downloads"],
            multipleApiKeysMultiplyCredits: false,
            multipleProvidersMultiplyCredits: false,
            creditsEnabled: false,
            billingEnabled: false,
            policyNotes: [],
            draftEstimates: [
              {
                id: "simple_image_scene",
                label: "Simple image scene",
                creditRangeLabel: "50-100 credits",
              },
            ],
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
          status: "auth_not_configured",
          message: "Authentication is not configured on this backend yet.",
        }),
      });
    });

    await page.goto("/credits", { waitUntil: "load" });

    await expect(page.getByTestId("credits-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Credits are not enabled yet" })).toBeVisible();
    await expect(
      page.getByText("Free BYOK users may later get 2500 daily Free AI Mixer platform credits."),
    ).toBeVisible();
    await expect(
      page.getByText("User pays provider generation cost through their own API keys in BYOK mode."),
    ).toBeVisible();
    await expect(
      page.getByText("Multiple API keys do not multiply daily platform credits."),
    ).toBeVisible();
    await expect(
      page.getByText("Prices and credit estimates are draft planning only, not final business commitments."),
    ).toBeVisible();
    await expect(page.getByText(/No live credit balance/i)).toBeVisible();
    await expect(page.getByText(/credits remaining/i)).toHaveCount(0);
  });

  test("pricing page renders honest planned state without fake purchase or subscription claims", async ({ page }) => {
    await page.route("**/billing/plans", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "billing_plans",
          message: "Pricing is presented as draft planning only. No checkout, payment processor, webhook, or entitlement flow is enabled.",
          providerBoundary: {
            state: "not_enabled_yet",
            supportedProviders: ["stripe", "paddle"],
            message: "Billing provider wiring is not enabled in this product phase.",
          },
          checkoutBoundary: {
            state: "not_enabled_yet",
            acceptedProviders: ["stripe", "paddle"],
            message: "Checkout is not enabled yet. No payment processor requests are made in this phase.",
          },
          webhookBoundary: {
            state: "not_live",
            acceptedProviders: ["stripe", "paddle"],
            message: "Webhook processing is not live. Credits cannot be granted from purchase events in this phase.",
          },
          plans: [
            {
              planId: "free_byok_policy",
              title: "Free BYOK policy draft",
              status: "draft_only",
              summary: "Free BYOK users may later get 2500 daily Free AI Mixer platform credits while still paying provider generation cost through their own API keys.",
            },
          ],
          draftEstimates: [
            {
              id: "full_medium_video_flow",
              label: "Full medium video flow",
              creditRangeLabel: "900-1500 credits",
            },
          ],
        }),
      });
    });

    await page.goto("/pricing", { waitUntil: "load" });

    await expect(page.getByTestId("pricing-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pricing is not enabled yet" })).toBeVisible();
    await expect(
      page.getByText(/provider generation cost through their own API keys/i),
    ).toBeVisible();
    await expect(
      page.getByText("Credits and billing are not enabled yet."),
    ).toBeVisible();
    await expect(
      page.getByText("Prices and credit estimates are draft planning only, not final business commitments."),
    ).toBeVisible();
    await expect(
      page.getByText("Checkout is not enabled yet. No payment processor requests are made in this phase."),
    ).toBeVisible();
    await expect(
      page.getByText(/does not offer checkout, subscriptions, purchases, or unlimited usage claims/i),
    ).toBeVisible();
    await expect(page.getByText(/subscribed/i)).toHaveCount(0);
  });

  test("frontend source avoids credit storage mutation and fake premium state", async () => {
    const frontendSource = listFrontendSourceFiles("src")
      .map((relativePath) => readSource(relativePath))
      .join("\n");

    expect(frontendSource).not.toContain("localStorage.setItem");
    expect(frontendSource).not.toContain("sessionStorage.setItem");
    expect(frontendSource).not.toContain("fakePremium");
    expect(frontendSource).not.toContain("premiumUser");
    expect(frontendSource).not.toContain("Unlimited plan");
    expect(frontendSource).not.toContain("Checkout now");
  });
});
