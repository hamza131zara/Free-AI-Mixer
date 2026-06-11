import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const readProjectFile = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

const forbiddenTokens = [
  "checkoutUrl",
  "checkout_url",
  "stripe.checkout.sessions.create",
  "paddle.checkout",
  "payment_success",
  "subscription_active",
  "fake_credit_purchase",
  "encrypted_payload",
  "secret_ref",
  "service_role",
  "api_key",
  "publicUrl",
  "signedUrl",
  "downloadUrl",
  "localPath",
  "internalRef",
  "base64",
];

test.describe("Launch Block 3 billing, credits, and subscriptions foundation", () => {
  test("defines fail-closed credit wallet, ledger, reservation, and readiness boundaries", () => {
    const repository = readProjectFile("backend/credits/creditWalletRepository.ts");
    const service = readProjectFile("backend/credits/creditService.ts");
    const reservationService = readProjectFile(
      "backend/credits/creditReservationService.ts",
    );
    const migration = readProjectFile(
      "backend/db/migrations/0006_launch_block3_billing_credits_subscriptions_draft.sql",
    );

    expect(repository).toContain("createNotConfiguredCreditWalletRepository");
    expect(repository).toContain("platform_credits_not_configured");
    expect(repository).toContain("reserveCredits");
    expect(repository).toContain("settleReservation");
    expect(repository).toContain("idempotency_key");
    expect(service).toContain("checkPlatformPaidGenerationReadiness");
    expect(service).toContain("credits_reserved");
    expect(service).toContain("insufficient_credits");
    expect(reservationService).toContain("refund");
    expect(reservationService).toContain("release");

    for (const tableName of [
      "billing_customers",
      "billing_subscriptions",
      "credit_wallets",
      "credit_ledger_entries",
      "credit_reservations",
      "usage_limits",
      "provider_cost_estimates",
      "billing_events",
    ]) {
      expect(migration).toContain(tableName);
    }

    expect(migration).toContain("Manual review/apply only");
    expect(migration).toContain("enable row level security");
    expect(migration).not.toContain("create policy allow all");
  });

  test("keeps billing providers, checkout, webhooks, and subscriptions unavailable", () => {
    const billingBoundary = readProjectFile(
      "backend/billing/billingProviderBoundary.ts",
    );
    const billingRoute = readProjectFile("backend/routes/billing.ts");
    const billingContracts = readProjectFile("backend/contracts/billingHttpTypes.ts");
    const pricingPage = readProjectFile("src/pages/PricingPage.tsx");
    const billingService = readProjectFile("src/services/billingService.ts");

    const combined = [
      billingBoundary,
      billingRoute,
      billingContracts,
      pricingPage,
      billingService,
    ].join("\n");

    expect(combined).toContain("billing_provider_not_configured");
    expect(combined).toContain("checkout_unavailable");
    expect(combined).toContain("webhookBoundary");
    expect(combined).toContain("subscriptions_not_configured");
    expect(combined).toContain("platform_credits_not_configured");
    expect(combined).toContain("providerCostEstimates");
    expect(combined).not.toContain("createCheckoutSession");
    expect(combined).not.toContain("subscription_active");
  });

  test("surfaces wallet unavailable honestly without fake balances or purchases", () => {
    const creditsRoute = readProjectFile("backend/routes/credits.ts");
    const creditsContracts = readProjectFile("backend/contracts/creditsHttpTypes.ts");
    const creditsPage = readProjectFile("src/pages/CreditsPage.tsx");
    const creditsTypes = readProjectFile("src/types/credits.ts");
    const creditsService = readProjectFile("src/services/creditsService.ts");

    const combined = [
      creditsRoute,
      creditsContracts,
      creditsPage,
      creditsTypes,
      creditsService,
    ].join("\n");

    expect(combined).toContain("platform_credits_not_configured");
    expect(combined).toContain("wallet_unavailable");
    expect(combined).toContain("No live platform credit balance is available yet.");
    expect(combined).toContain("does not charge users or fake credit purchases");
    expect(combined).not.toContain("fake purchase success");
    expect(combined).not.toContain("unlimited credits");
  });

  test("documents Block 3 as foundation-only and preserves safety boundaries", () => {
    const docs = [
      readProjectFile("docs/architecture.md"),
      readProjectFile("docs/roadmap.md"),
      readProjectFile("docs/known-issues.md"),
      readProjectFile("docs/phases.md"),
    ].join("\n");

    expect(docs).toContain("Launch Block 3");
    expect(docs).toContain("credit ledger");
    expect(docs).toContain("reservation");
    expect(docs).toContain("no live payment processor");
    expect(docs).toContain("manual migration");
    expect(docs).toContain("BYOK remains separate");
    expect(docs).toContain("platform_credits_not_configured");
  });

  test("does not introduce secrets, public delivery, provider calls, or fake payment success", () => {
    const source = [
      readProjectFile("backend/credits/creditWalletRepository.ts"),
      readProjectFile("backend/credits/creditService.ts"),
      readProjectFile("backend/routes/credits.ts"),
      readProjectFile("backend/routes/billing.ts"),
      readProjectFile("src/pages/CreditsPage.tsx"),
      readProjectFile("src/pages/PricingPage.tsx"),
    ].join("\n");

    for (const token of forbiddenTokens) {
      expect(source).not.toContain(token);
    }

    expect(source).not.toContain("api.openai.com");
    expect(source).not.toContain("generativelanguage.googleapis.com");
    expect(source).not.toContain("fetch(\"https://");
  });
});
