import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const catalogBody = {
  kind: "cards_catalog",
  message:
    "Card templates are available as a static local-preview catalog only. No AI generation, download, share, QR code, or persistence is enabled.",
  templates: [
    {
      cardTemplateId: "card-birthday-confetti-frame",
      slug: "birthday-confetti-frame",
      title: "Birthday confetti frame",
      category: "birthday",
      occasion: "Birthday celebration",
      description:
        "A cheerful birthday card layout with confetti accents, headline space, and a personal message block.",
      supportedFields: [
        {
          fieldId: "recipient_name",
          label: "Recipient name",
          kind: "text",
          placeholder: "Avery",
          required: true,
          helpText: "Shown in the main greeting.",
        },
      ],
      layout: "portrait",
      themeTokens: {
        background: "#fff7ed",
        foreground: "#7c2d12",
        accent: "#fb7185",
        border: "#fdba74",
      },
      outputAspectRatio: "4:5",
      safeUseLabel: "Decorative greeting card template only",
      samplePreviewKind: "static_sample_only",
      status: "published",
      lastReviewedAt: "2026-05-23T00:00:00.000Z",
      sourceOwnershipNotes:
        "Uses original generic decorative styling only. No copyrighted characters or brand assets.",
      disclaimer:
        "Static card template MVP only. No AI generation, download, share, QR code, or project saving is enabled.",
    },
    {
      cardTemplateId: "card-business-contact-minimal",
      slug: "business-contact-minimal",
      title: "Minimal business contact card",
      category: "business",
      occasion: "Business contact card",
      description:
        "A clean decorative business contact card shell for brand name, contact details, and optional website/social handle.",
      supportedFields: [
        {
          fieldId: "business_name",
          label: "Business name",
          kind: "text",
          placeholder: "Northfield Studio",
          required: true,
          helpText: "Primary organization or brand name.",
        },
      ],
      layout: "landscape",
      themeTokens: {
        background: "#f8fafc",
        foreground: "#0f172a",
        accent: "#2563eb",
        border: "#cbd5e1",
      },
      outputAspectRatio: "16:9",
      safeUseLabel:
        "Decorative non-financial business contact template only. Not a payment or bank card.",
      samplePreviewKind: "static_sample_only",
      status: "published",
      lastReviewedAt: "2026-05-23T00:00:00.000Z",
      sourceOwnershipNotes:
        "No payment logos, bank marks, card numbers, CVV, expiry, or deceptive financial styling.",
      disclaimer:
        "This is a decorative contact card shell only. No hosted sharing, QR code, or account persistence is available.",
    },
  ],
} as const;

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

test.describe("product phase 12 card gallery shell", () => {
  test("cards gallery renders an honest static-template MVP shell", async ({ page }) => {
    await page.route("**/cards/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(catalogBody),
      });
    });

    await page.goto("/cards", { waitUntil: "load" });

    await expect(page.getByTestId("cards-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Card Generator static template MVP" })).toBeVisible();
    await expect(page.getByText("AI generation, downloads, sharing, QR codes, and project saving are not enabled yet.")).toBeVisible();
    await expect(page.getByTestId("cards-gallery-grid")).toContainText("static sample only");
    await expect(page.getByTestId("cards-gallery-grid")).toContainText(
      "Decorative non-financial business contact template only. Not a payment or bank card.",
    );
    await expect(page.getByText(/AI generated|download now|share now|qr ready/i)).toHaveCount(0);
  });

  test("card category pages render safe static templates only", async ({ page }) => {
    await page.route("**/cards/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(catalogBody),
      });
    });

    await page.goto("/cards/business", { waitUntil: "load" });

    await expect(page.getByTestId("card-category-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Business card templates" })).toBeVisible();
    await expect(page.getByTestId("card-category-grid")).toContainText("No payment logos, bank marks, card numbers, CVV, expiry, or deceptive financial styling.");
    await expect(page.getByLabel(/card number|cvv|expiry/i)).toHaveCount(0);
  });

  test("frontend source avoids supabase storage and ownership shortcuts for cards", async () => {
    const frontendSource = listFrontendSourceFiles("src")
      .map((relativePath) => readSource(relativePath))
      .join("\n");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("localStorage.setItem(\"card");
    expect(frontendSource).not.toContain("sessionStorage.setItem(\"card");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain("SERVICE_ROLE");
  });
});
