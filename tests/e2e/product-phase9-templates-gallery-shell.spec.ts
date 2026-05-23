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

const catalogBody = {
  kind: "template_catalog",
  message:
    "Static template metadata is available for planning and gallery browsing only. No template generation or project creation is enabled.",
  templates: [
    {
      templateId: "template-social-launch-cut",
      slug: "social-launch-cut",
      title: "Social launch cut",
      description: "A short social video structure for announcing a launch with headline text, product media, and a closing CTA frame.",
      category: "social_video",
      useCase: "Short launch teaser for social channels.",
      acceptedAssetTypes: ["image", "video", "logo"],
      outputType: "short_video",
      providerCapabilityRequirements: ["video_generation", "image_generation"],
      draftCreditEstimate: {
        label: "250-400 credits",
        planningOnly: true,
      },
      status: "planned",
      version: "0.1.0",
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z",
      sampleLabel: "Static sample content only",
    },
  ],
} as const;

const detailBody = {
  kind: "template_detail",
  message:
    "Template detail is available in planning-only form. Generation, downloads, and project saves are not enabled yet.",
  template: {
    ...catalogBody.templates[0],
    requiredInputs: [
      {
        kind: "text_field",
        fieldId: "headline",
        label: "Headline",
        description: "Primary launch message shown in the opener.",
        required: true,
        validationRules: [{ type: "required", message: "Headline is required." }],
        capabilityRequirements: [],
      },
    ],
    renderRequirements: {
      requiresGenerationRuntime: true,
      requiresRenderVerification: true,
      requiresBackendDeliveryDescriptor: true,
      notes: ["Final template output must use the same backend generation runtime as Mixer scenes later."],
    },
    safetyLabels: ["static_sample_only", "generation_not_enabled_yet"],
  },
} as const;

test.describe("product phase 9 templates gallery shell", () => {
  test("templates page renders honest gallery shell with static sample labels and no fake output", async ({ page }) => {
    await page.route("**/templates/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(catalogBody),
      });
    });

    await page.route("**/templates/template-social-launch-cut", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detailBody),
      });
    });

    await page.goto("/templates", { waitUntil: "load" });

    const templateCard = page.getByTestId("template-card-template-social-launch-cut");
    await expect(page.getByTestId("templates-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Templates gallery shell" })).toBeVisible();
    await expect(page.getByText("Static sample content only. Generation is not enabled yet.")).toBeVisible();
    await expect(templateCard).toBeVisible();
    await expect(templateCard).toContainText("Static sample content only");
    await expect(page.getByText("Draft planning only. Not a final price or live credit deduction.")).toBeVisible();
    await expect(page.getByText(/generated output/i)).toHaveCount(0);
    await expect(page.getByText(/download now/i)).toHaveCount(0);
    await expect(page.getByText(/credits remaining/i)).toHaveCount(0);
  });

  test("template detail stays planning-only with honest disabled CTA", async ({ page }) => {
    await page.route("**/templates/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(catalogBody),
      });
    });

    await page.route("**/templates/template-social-launch-cut", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detailBody),
      });
    });

    await page.goto("/templates", { waitUntil: "load" });
    await page.getByRole("button", { name: "Review template detail" }).click();

    await expect(page.getByTestId("template-detail-panel")).toContainText(
      "Generation, downloads, and project saving are not enabled yet.",
    );
    await expect(page.getByRole("button", { name: "Generation not enabled yet" })).toBeDisabled();
    await expect(page.getByText(/fake generated output/i)).toHaveCount(0);
    await expect(page.getByText(/save to project/i)).toHaveCount(0);
  });

  test("frontend source avoids supabase storage and template execution shortcuts", async () => {
    const frontendSource = listFrontendSourceFiles("src")
      .map((relativePath) => readSource(relativePath))
      .join("\n");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("generate template");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain("SERVICE_ROLE");
  });
});
