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

test.describe("merged phase 23D-1 no fake auth or token storage", () => {
  test("frontend source still avoids Supabase auth client token persistence and fake auth shortcuts", () => {
    const frontendSource = listFrontendSourceFiles("src")
      .map((relativePath) => readSource(relativePath))
      .join("\n");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".auth.signIn");
    expect(frontendSource).not.toContain(".auth.getSession");
    expect(frontendSource).not.toContain("localStorage.setItem(\"auth");
    expect(frontendSource).not.toContain("localStorage.setItem('auth");
    expect(frontendSource).not.toContain("sessionStorage.setItem(\"auth");
    expect(frontendSource).not.toContain("sessionStorage.setItem('auth");
    expect(frontendSource).not.toContain("fakeSession");
    expect(frontendSource).not.toContain("fakeWorkspace");
    expect(frontendSource).not.toContain("fake-user");
    expect(frontendSource).not.toContain(
      "VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
    );
    expect(frontendSource).not.toContain("VITE_SUPABASE_SERVICE_ROLE_KEY");
  });

  test("localStorage cannot create frontend auth or workspace access", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("authToken", "pretend-token");
      window.localStorage.setItem("workspaceId", "pretend-workspace");
      window.sessionStorage.setItem("authToken", "pretend-token");
    });

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

    await page.goto("/settings/providers", { waitUntil: "load" });

    await expect(page.getByTestId("protected-route-shell")).toBeVisible();
    await expect(page.getByTestId("provider-settings-page")).toHaveCount(0);
    await expect(page.getByTestId("protected-route-shell-status")).toContainText(
      "Sign in is required before this page can show verified account data.",
    );
  });
});
