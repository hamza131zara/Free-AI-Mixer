import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const viewportCases = [
  { name: "desktop", width: 1440, height: 960 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const placeholderRoutes = [
  {
    path: "/templates",
    testId: "templates-page",
    heading: "Templates are not enabled yet",
  },
  {
    path: "/projects",
    testId: "projects-page",
    heading: "Projects are not enabled yet",
  },
  {
    path: "/history",
    testId: "exports-page",
    heading: "Export history is not enabled yet",
  },
  {
    path: "/credits",
    testId: "credits-page",
    heading: "Credits are not enabled yet",
  },
  {
    path: "/pricing",
    testId: "pricing-page",
    heading: "Pricing is not enabled yet",
  },
  {
    path: "/help",
    testId: "help-page",
    heading: "Help and support are not enabled yet",
  },
  {
    path: "/privacy",
    testId: "privacy-page",
    heading: "Privacy page is not enabled yet",
  },
  {
    path: "/terms",
    testId: "terms-page",
    heading: "Terms page is not enabled yet",
  },
] as const;

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

test.describe("product phase 1 navigation shell", () => {
  test("landing route renders", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });

    await expect(page.getByTestId("home-page")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Free AI Mixer now has a real navigation shell.",
      }),
    ).toBeVisible();
    await expect(
      page.getByTestId("home-page").getByRole("button", { name: "Open Mixer" }).first(),
    ).toBeVisible();
  });

  test("mixer route renders the preserved workbench", async ({ page }) => {
    await page.goto("/mixer", { waitUntil: "load" });

    await expect(page.getByTestId("mixer-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Free AI Mixer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Scene" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Timeline" })).toBeVisible();
  });

  test("placeholder routes render honest not-enabled-yet states", async ({ page }) => {
    for (const route of placeholderRoutes) {
      await test.step(route.path, async () => {
        await page.goto(route.path, { waitUntil: "load" });

        await expect(page.getByTestId(route.testId)).toBeVisible();
        await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
        await expect(page.getByTestId(route.testId)).toContainText(
          /not enabled yet|coming in a later product phase/i,
        );
      });
    }
  });

  test("navigation works across routes", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });

    await page.getByRole("button", { name: "Mixer", exact: true }).click();
    await expect(page).toHaveURL(/\/mixer$/);
    await expect(page.getByTestId("mixer-page")).toBeVisible();

    await page.getByRole("button", { name: "Templates", exact: true }).click();
    await expect(page).toHaveURL(/\/templates$/);
    await expect(page.getByTestId("templates-page")).toBeVisible();

    await page.getByRole("button", { name: "Credits", exact: true }).click();
    await expect(page).toHaveURL(/\/credits$/);
    await expect(page.getByTestId("credits-page")).toBeVisible();

    await page.getByRole("button", { name: "Privacy", exact: true }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByTestId("privacy-page")).toBeVisible();
  });

  test("desktop tablet and mobile shell smoke passes", async ({ page }) => {
    for (const viewport of viewportCases) {
      await test.step(viewport.name, async () => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        await page.goto("/", { waitUntil: "load" });
        await expect(page.getByRole("button", { name: "Go to home" })).toBeVisible();

        if (viewport.name === "mobile") {
          await page.getByRole("button", { name: "Toggle navigation" }).click();
          await expect(page.getByRole("button", { name: "Dashboard", exact: true })).toBeVisible();
          await expect(page.getByRole("button", { name: "Log in", exact: true })).toBeVisible();
        } else {
          await expect(page.getByRole("button", { name: "Dashboard", exact: true })).toBeVisible();
          await expect(page.getByRole("button", { name: "Mixer", exact: true })).toBeVisible();
          await expect(page.getByRole("button", { name: "Log in", exact: true })).toBeVisible();
        }
      });
    }
  });

  test("placeholder pages do not claim unavailable features are active", async ({ page }) => {
    await page.goto("/credits", { waitUntil: "load" });
    await expect(page.getByText("Credits are not enabled yet")).toBeVisible();
    await expect(page.getByText("No live credit balance")).toBeVisible();
    await expect(page.getByText("2500 daily Free AI Mixer platform credits")).toBeVisible();

    await page.goto("/settings/providers", { waitUntil: "load" });
    await expect(page.getByText("Provider settings and routing foundation")).toBeVisible();
    await expect(
      page.getByText("Secure API key connection is not enabled yet.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Multiple API keys do not multiply daily platform credits."),
    ).toBeVisible();
  });

  test("frontend source still avoids direct supabase storage usage and fake credits or provider setup", async () => {
    const frontendSource = listFrontendSourceFiles("src")
      .map((relativePath) => readSource(relativePath))
      .join("\n");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain("SERVICE_ROLE");
    expect(frontendSource).not.toContain("Provider connected");
    expect(frontendSource).not.toContain("Credits remaining: 2500");
  });
});
