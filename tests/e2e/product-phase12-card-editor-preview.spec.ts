import { expect, test } from "@playwright/test";

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
        {
          fieldId: "event_title",
          label: "Headline",
          kind: "text",
          placeholder: "Happy Birthday!",
          required: true,
          helpText: "Primary celebratory headline.",
        },
        {
          fieldId: "short_message",
          label: "Short message",
          kind: "multiline",
          placeholder: "Wishing you a joyful year ahead.",
          required: true,
          helpText: "Short personal note shown in the body.",
        },
        {
          fieldId: "sender_name",
          label: "Sender name",
          kind: "text",
          placeholder: "Jordan",
          required: false,
          helpText: "Optional sign-off in the footer.",
        },
        {
          fieldId: "theme_option",
          label: "Theme",
          kind: "theme_option",
          required: true,
          helpText: "Planning-only local theme switch for the preview shell.",
          options: [
            { value: "sunrise", label: "Sunrise" },
            { value: "berry", label: "Berry" },
          ],
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
  ],
} as const;

const detailBody = {
  kind: "card_template_detail",
  message:
    "Card template detail is available for local preview planning only. Download, share, QR code, and project saving are not enabled yet.",
  template: catalogBody.templates[0],
} as const;

test.describe("product phase 12 card editor preview", () => {
  test("card editor preview stays local and honest", async ({ page }) => {
    await page.route("**/cards/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(catalogBody),
      });
    });

    await page.route("**/cards/card-birthday-confetti-frame", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detailBody),
      });
    });

    await page.goto("/cards/template/birthday-confetti-frame", { waitUntil: "load" });

    await expect(page.getByTestId("card-template-editor-page")).toBeVisible();
    await expect(page.getByTestId("card-editor-fields")).toContainText("User-entered text renders safely as plain text in the card preview.");
    await expect(page.getByTestId("card-live-preview")).toContainText("Static card template MVP only. No AI generation, no export job, and no delivery URL are created.");

    await page.getByLabel("Headline").fill("Happy Birthday, Noor!");
    await page.getByLabel("Recipient name").fill("Noor");
    await page.getByLabel("Short message").fill("Have a joyful day with cake and confetti.");
    await page.getByLabel("Sender name").fill("From Mina");

    await expect(page.getByTestId("card-live-preview")).toContainText("Happy Birthday, Noor!");
    await expect(page.getByTestId("card-live-preview")).toContainText("Noor");
    await expect(page.getByTestId("card-live-preview")).toContainText("Have a joyful day with cake and confetti.");

    await expect(page.getByRole("button", { name: "Download coming later" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Share and QR coming later" })).toBeDisabled();
    await expect(page.getByRole("button", { name: /save to project|download now|share now/i })).toHaveCount(0);
  });
});
