import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("product phase 4 project library and export history shell", () => {
  test("projects page renders protected auth-unavailable state honestly", async ({
    page,
  }) => {
    await page.route("**/auth/session", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "auth_unavailable",
          status: "auth_not_configured",
          message: "Authentication is not configured on this backend yet.",
        }),
      });
    });

    await page.goto("/projects", { waitUntil: "load" });

    await expect(page.getByTestId("protected-route-shell")).toBeVisible();
    await expect(page.getByTestId("protected-route-shell-status")).toContainText(
      "Authentication unavailable",
    );
    await expect(page.getByTestId("protected-route-shell-status")).toContainText(
      "Authentication is not configured on this backend yet.",
    );
    await expect(page.getByTestId("projects-page")).toHaveCount(0);
  });

  test("projects and history pages render authenticated honest empty states with no fake rows", async ({
    page,
  }) => {
    await page.route("**/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "authenticated_session",
          status: "authenticated",
          message: "Backend session verified.",
          identity: {
            userId: "verified-phase4-user",
            workspaceId: "workspace-phase4",
            authProvider: "session",
            authSubject: "verified-phase4-user",
          },
        }),
      });
    });

    await page.route("**/project-library/projects", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "project_library",
          status: "authenticated",
          message:
            "Project library is available for this verified session with durable project metadata persistence.",
          activeWorkspaceId: "workspace-phase4",
          persistence: "durable",
          projects: [],
        }),
      });
    });

    await page.route("**/project-library/history", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "export_history",
          status: "authenticated",
          message:
            "Export history is available for this verified session, but durable account-linked history is not enabled yet.",
          activeWorkspaceId: "workspace-phase4",
          historyState: "not_enabled_yet",
          exports: [],
        }),
      });
    });

    await page.goto("/projects", { waitUntil: "load" });
    await expect(page.getByTestId("projects-empty-state")).toBeVisible();
    await expect(page.getByTestId("projects-empty-state")).toContainText(
      "No durable project metadata exists for this workspace yet.",
    );
    await expect(page.getByTestId("projects-page")).not.toContainText("Project 1");
    await expect(page.getByTestId("projects-page")).not.toContainText("Created on");

    await page.goto("/history", { waitUntil: "load" });
    await expect(page.getByTestId("export-history-page")).toBeVisible();
    await expect(page.getByTestId("history-empty-state")).toContainText(
      "Export history is not enabled yet",
    );
    await expect(page.getByTestId("export-history-page")).not.toContainText("Completed video");
    await expect(page.getByTestId("export-history-page")).not.toContainText("Download");
    await expect(page.getByTestId("export-history-page")).not.toContainText("artifact ready");
  });

  test("frontend source avoids local ownership shortcuts supabase storage and service-role exposure", async () => {
    const frontendSource = [
      "src/pages/ProjectsPage.tsx",
      "src/pages/ExportHistoryPage.tsx",
      "src/services/projectLibraryService.ts",
      "src/services/exportHistoryService.ts",
      "src/store/projectLibraryStore.ts",
      "src/store/exportHistoryStore.ts",
      "src/types/projectLibrary.ts",
      "src/types/exportHistory.ts",
    ]
      .map((relativePath) => readSource(relativePath))
      .join("\n");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain("SERVICE_ROLE");
    expect(frontendSource).not.toContain("localStorage.getItem");
    expect(frontendSource).not.toContain("localStorage.setItem");
    expect(frontendSource).not.toContain("sessionStorage.setItem");
    expect(frontendSource).not.toContain("fake-project");
  });
});
