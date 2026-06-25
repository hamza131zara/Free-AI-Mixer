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

test.describe("product phase 8 ledger and billing boundary", () => {
  test("credit policy and pricing boundaries stay read-only while credits status fails closed without auth", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const policyResponse = await fetch(`${baseUrl}/credits/policy`);
      expect(policyResponse.status).toBe(200);
      await expect(policyResponse.json()).resolves.toMatchObject({
        kind: "credits_policy",
        policy: {
          freeByokDailyCreditsLater: 2500,
          creditsEnabled: false,
          billingEnabled: false,
        },
      });

      const statusResponse = await fetch(`${baseUrl}/credits/status`);
      expect(statusResponse.status).toBe(503);
      await expect(statusResponse.json()).resolves.toEqual({
        kind: "credits_unavailable",
        status: "auth_not_configured",
        message: "Authentication is not configured on this backend yet.",
      });

      const plansResponse = await fetch(`${baseUrl}/billing/plans`);
      expect(plansResponse.status).toBe(200);
      await expect(plansResponse.json()).resolves.toMatchObject({
        kind: "billing_plans",
        providerBoundary: {
          state: "billing_provider_not_configured",
        },
        checkoutBoundary: {
          state: "checkout_unavailable",
        },
        webhookBoundary: {
          state: "not_live",
        },
        subscriptionBoundary: {
          state: "subscriptions_not_configured",
        },
        platformCreditsBoundary: {
          state: "platform_credits_not_configured",
        },
      });
    } finally {
      await stopServer(server);
    }
  });

  test("billing webhook route is not live and credits status does not trust header shortcuts", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const fakeHeaderResponse = await fetch(`${baseUrl}/credits/status`, {
        headers: {
          "x-user-id": "fake-user",
          "x-workspace-id": "fake-workspace",
          cookie: "fake-session=must-not-authenticate",
        },
      });

      expect(fakeHeaderResponse.status).toBe(503);
      await expect(fakeHeaderResponse.json()).resolves.toEqual({
        kind: "credits_unavailable",
        status: "auth_not_configured",
        message: "Authentication is not configured on this backend yet.",
      });

      const webhookResponse = await fetch(`${baseUrl}/billing/webhook`, {
        method: "POST",
      });

      expect(webhookResponse.status).toBe(404);
    } finally {
      await stopServer(server);
    }
  });

  test("credits and billing boundary source avoids payment processors secrets and frontend-style mutation shortcuts", async () => {
    const combinedSource = [
      readSource("backend/contracts/creditsHttpTypes.ts"),
      readSource("backend/contracts/billingHttpTypes.ts"),
      readSource("backend/credits/creditPolicy.ts"),
      readSource("backend/credits/creditLedgerTypes.ts"),
      readSource("backend/credits/creditReservationTypes.ts"),
      readSource("backend/billing/billingProviderBoundary.ts"),
      readSource("backend/routes/credits.ts"),
      readSource("backend/routes/billing.ts"),
      readSource("src/services/creditsService.ts"),
      readSource("src/services/billingService.ts"),
      readSource("src/store/creditsStore.ts"),
      readSource("src/store/billingStore.ts"),
      readSource("src/types/credits.ts"),
      readSource("src/types/billing.ts"),
      readSource("src/pages/CreditsPage.tsx"),
      readSource("src/pages/PricingPage.tsx"),
    ].join("\n");

    expect(combinedSource).not.toContain('req.headers["x-user-id"]');
    expect(combinedSource).not.toContain('req.headers["x-workspace-id"]');
    expect(combinedSource).not.toContain("localStorage.setItem");
    expect(combinedSource).not.toContain("sessionStorage.setItem");
    expect(combinedSource).not.toContain("api.stripe.com");
    expect(combinedSource).not.toContain("checkout.sessions");
    expect(combinedSource).not.toContain("paddle.com");
    expect(combinedSource).not.toContain("Paddle.Checkout");
    expect(combinedSource).not.toContain("@stripe/stripe-js");
    expect(combinedSource).not.toContain("SERVICE_ROLE");
    expect(combinedSource).not.toContain("service_role");
  });
});
