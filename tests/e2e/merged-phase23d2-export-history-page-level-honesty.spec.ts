import { expect, test } from "@playwright/test";

test.describe("merged phase 23D-2 export history page-level honesty", () => {
  test("export history remains page-level honest and is not over-tightened by the protected shell", async ({
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
            userId: "verified-history-user",
            workspaceId: "workspace-history",
            authProvider: "supabase",
            authSubject: "verified-history-user",
          },
        }),
      });
    });

    await page.route("**/project-library/history", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "export_history_forbidden",
          status: "workspace_required",
          message: "Workspace access is required before this page can show backend-owned data.",
        }),
      });
    });

    await page.goto("/history", { waitUntil: "load" });

    await expect(page.getByTestId("protected-route-shell")).toHaveCount(0);
    await expect(page.getByTestId("export-history-page")).toBeVisible();
    await expect(page.getByTestId("history-access-state")).toContainText("forbidden");
    await expect(page.getByTestId("history-forbidden-state")).toBeVisible();

    await page.unroute("**/project-library/history");
    await page.route("**/project-library/history", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "export_history_unavailable",
          status: "workspace_runtime_not_configured",
          message: "Workspace authority is not configured on this backend yet.",
        }),
      });
    });

    await page.reload({ waitUntil: "load" });
    await expect(page.getByTestId("history-access-state")).toContainText("unavailable");
    await expect(page.getByTestId("history-access-state")).toContainText(
      "Workspace authority is not configured on this backend yet.",
    );
    await expect(page.getByTestId("export-history-page")).not.toContainText("Completed video");
  });
});
