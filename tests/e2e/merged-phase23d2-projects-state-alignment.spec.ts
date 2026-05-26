import { expect, test } from "@playwright/test";

test.describe("merged phase 23D-2 projects state alignment", () => {
  test("projects route shows auth-required shell and page-level workspace-required and unavailable states honestly", async ({
    page,
  }) => {
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

    await page.goto("/projects", { waitUntil: "load" });
    await expect(page.getByTestId("protected-route-shell")).toBeVisible();
    await expect(page.getByTestId("projects-page")).toHaveCount(0);

    await page.unroute("**/auth/session");
    await page.route("**/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "authenticated_session",
          status: "authenticated",
          message: "Backend session verified.",
          identity: {
            userId: "verified-projects-user",
            workspaceId: "workspace-projects",
            authProvider: "supabase",
            authSubject: "verified-projects-user",
          },
        }),
      });
    });

    await page.route("**/project-library/projects", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "project_library_forbidden",
          status: "workspace_required",
          message: "Workspace access is required before this page can show backend-owned data.",
        }),
      });
    });

    await page.reload({ waitUntil: "load" });
    await expect(page.getByTestId("protected-route-shell")).toHaveCount(0);
    await expect(page.getByTestId("projects-access-state")).toContainText("forbidden");
    await expect(page.getByTestId("projects-access-state")).toContainText(
      "Workspace access is required before this page can show backend-owned data.",
    );
    await expect(page.getByTestId("projects-forbidden-state")).toBeVisible();

    await page.unroute("**/project-library/projects");
    await page.route("**/project-library/projects", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "project_library_unavailable",
          status: "workspace_runtime_not_configured",
          message: "Workspace authority is not configured on this backend yet.",
        }),
      });
    });

    await page.reload({ waitUntil: "load" });
    await expect(page.getByTestId("projects-access-state")).toContainText("unavailable");
    await expect(page.getByTestId("projects-access-state")).toContainText(
      "Workspace authority is not configured on this backend yet.",
    );
  });
});
