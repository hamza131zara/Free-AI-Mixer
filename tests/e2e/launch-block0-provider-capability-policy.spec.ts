import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const forbiddenClaims = [
  /free OpenAI images/i,
  /free Gemini videos/i,
  /free Imagen images/i,
  /free Veo videos/i,
  /unlimited free generation/i,
  /daily free provider credits guaranteed/i,
];

const forbiddenVisibleTokens = [
  "api.openai.com",
  "generativelanguage.googleapis.com",
  "stripe.com",
  "checkout.session",
  "downloadUrl",
  "publicUrl",
  "signedUrl",
  "secret_ref",
  "encrypted_payload",
  "service-role",
  "localPath",
  "internalRef",
  "storageRef",
  "base64",
];

const installExternalTripwires = async (page: Page) => {
  await page.route("**/*", async (route) => {
    const url = route.request().url();

    if (
      url.includes("api.openai.com") ||
      url.includes("generativelanguage.googleapis.com") ||
      url.includes("imagen") ||
      url.includes("veo") ||
      url.includes("runway") ||
      url.includes("pika") ||
      url.includes("stripe") ||
      url.includes("supabase.co/storage")
    ) {
      throw new Error(`Unexpected provider, storage, or billing call: ${url}`);
    }

    await route.continue();
  });
};

const readProjectFile = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

const expectNoForbiddenClaims = (text: string) => {
  for (const claim of forbiddenClaims) {
    expect(text).not.toMatch(claim);
  }
};

const expectNoUnsafeVisibleTokens = async (page: Page) => {
  const bodyText = await page.locator("body").innerText();
  const browserState = await page.evaluate(() =>
    JSON.stringify({
      localStorage: { ...window.localStorage },
      sessionStorage: { ...window.sessionStorage },
      url: window.location.href,
    }),
  );
  const combined = `${bodyText}\n${browserState}`;

  for (const token of forbiddenVisibleTokens) {
    expect(combined).not.toContain(token);
  }

  expectNoForbiddenClaims(combined);
};

test.describe("Launch Block 0 provider capability and free/paid policy", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await installExternalTripwires(page);
  });

  test("renders honest policy copy in generation and pricing surfaces", async ({
    page,
  }) => {
    await page.goto("/mixer");

    await expect(page.getByTestId("generation-policy-banner")).toContainText(
      "Free workspace and mock/demo generation are available.",
    );
    await expect(page.getByTestId("generation-policy-banner")).toContainText(
      "Bring your own API key to use provider quota where available.",
    );
    await expect(page.getByTestId("generation-policy-banner")).toContainText(
      "Some image/video provider APIs require separate provider billing",
    );
    await expect(page.getByTestId("generation-policy-banner")).toContainText(
      "Platform credits/subscriptions are coming later",
    );
    await expect(page.getByText("Mock generation lab")).toBeVisible();
    await expect(page.getByText("Mock/demo/local generation").first()).toBeVisible();
    await expect(
      page.getByText("Real video providers remain a future").first(),
    ).toBeVisible();
    await expectNoUnsafeVisibleTokens(page);

    await page.goto("/pricing");

    await expect(page.getByTestId("free-paid-policy-grid")).toContainText(
      "Free workspace and mock/demo generation are available.",
    );
    await expect(page.getByTestId("free-paid-policy-grid")).toContainText(
      "BYOK does not create provider credits.",
    );
    await expect(page.getByTestId("free-paid-policy-grid")).toContainText(
      "platform_credits_not_configured",
    );
    await expect(page.getByText("Checkout is not enabled yet.")).toBeVisible();
    await expectNoUnsafeVisibleTokens(page);
  });

  test("documents provider policy, launch blocks, and blocked paid-provider claims", () => {
    const policyService = readProjectFile(
      "src/services/providerCapabilityPolicyService.ts",
    );
    const providerSettingsPage = readProjectFile(
      "src/pages/ProviderSettingsPage.tsx",
    );
    const roadmap = readProjectFile("docs/roadmap.md");
    const knownIssues = readProjectFile("docs/known-issues.md");
    const architecture = readProjectFile("docs/architecture.md");
    const phases = readProjectFile("docs/phases.md");
    const combined = [
      policyService,
      providerSettingsPage,
      roadmap,
      knownIssues,
      architecture,
      phases,
    ].join("\n");

    expect(policyService).toContain("platform_credits_not_configured");
    expect(policyService).toContain("provider_billing_required");
    expect(policyService).toContain("provider_quota_unavailable");
    expect(policyService).toContain("Google Gemini / Imagen / Veo");
    expect(providerSettingsPage).toContain("provider-capability-policy");
    expect(providerSettingsPage).toContain(
      "Free workspace and mock/demo generation are available.",
    );
    expect(providerSettingsPage).toContain(
      "Platform credits/subscriptions are coming later",
    );

    for (const blockName of [
      "Block 0 - Provider Capability + Free/Paid Policy",
      "Block 1 - Production Auth + Supabase Persistence",
      "Block 2 - Production Storage + Artifact Delivery",
      "Block 3 - Billing / Credits / Subscriptions",
      "Block 4 - Real Provider Generation",
      "Block 5 - Real Video Generation",
      "Block 6 - Production Deployment",
      "Block 7 - Final Launch QA / Private Beta / Public Launch",
    ]) {
      expect(roadmap).toContain(blockName);
    }

    expect(combined).toContain("BYOK does not create free provider credits");
    expect(combined).toContain("separate provider billing");
    expect(policyService).not.toContain("createCheckoutSession");
    expect(policyService).not.toContain("signedUrl:");
    expect(policyService).not.toContain("publicUrl:");
    expect(policyService).not.toContain("downloadUrl:");
    expectNoForbiddenClaims(combined);
  });
});
