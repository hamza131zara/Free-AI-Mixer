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

test.describe("product phase 10 support and legal shell", () => {
  test("help page renders honest support shell with no fake ticket submission", async ({ page }) => {
    await page.goto("/help", { waitUntil: "load" });

    await expect(page.getByTestId("help-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Help and support shell" })).toBeVisible();
    await expect(page.getByText("No fake ticket ID, fake submitted state, or fake staff response exists here.")).toBeVisible();
    await expect(page.getByText(/support ticket #/i)).toHaveCount(0);
    await expect(page.getByText(/submitted successfully/i)).toHaveCount(0);
  });

  test("legal pages use draft legal-readiness wording and avoid fake compliance claims", async ({ page }) => {
    const legalRoutes = [
      { path: "/privacy", heading: "Privacy policy draft", testId: "privacy-page" },
      { path: "/terms", heading: "Terms draft", testId: "terms-page" },
      { path: "/cookies", heading: "Cookies and local storage draft", testId: "cookies-page" },
      { path: "/acceptable-use", heading: "Acceptable use draft", testId: "acceptable-use-page" },
      { path: "/data-retention", heading: "Data retention draft", testId: "data-retention-page" },
    ] as const;

    for (const route of legalRoutes) {
      await page.goto(route.path, { waitUntil: "load" });
      await expect(page.getByTestId(route.testId)).toBeVisible();
      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
      await expect(page.getByText("Draft legal-readiness only")).toBeVisible();
    }

    const pageText = await page.textContent("body");
    expect(pageText ?? "").not.toMatch(/GDPR|CCPA|SOC2|ISO 27001|lawyer-approved/i);
  });

  test("frontend source keeps support and legal shells static with no fake support workflow", async () => {
    const frontendSource = listFrontendSourceFiles("src")
      .map((relativePath) => readSource(relativePath))
      .join("\n");

    expect(frontendSource).not.toContain("support ticket created");
    expect(frontendSource).not.toContain("ticketId:");
    expect(frontendSource).not.toContain("submitSupportTicket(");
    expect(frontendSource).not.toContain("@supabase/supabase-js");
  });
});
