import { expect, test, type Page } from "@playwright/test";

const projects = [
  {
    projectId: "11111111-1111-4111-8111-111111111111",
    title: "North Star Project",
    status: "active",
    createdAt: "2026-06-21T01:00:00.000Z",
    updatedAt: "2026-06-21T01:00:00.000Z",
  },
  {
    projectId: "22222222-2222-4222-8222-222222222222",
    title: "Second Safe Project",
    status: "active",
    createdAt: "2026-06-21T02:00:00.000Z",
    updatedAt: "2026-06-21T02:00:00.000Z",
  },
  {
    projectId: "33333333-3333-4333-8333-333333333333",
    title: "Unavailable Project",
    status: "active",
    createdAt: "2026-06-21T03:00:00.000Z",
    updatedAt: "2026-06-21T03:00:00.000Z",
  },
] as const;

const authSessionResponse = {
  kind: "authenticated_session",
  status: "authenticated",
  message: "Backend session verified.",
  identity: {
    userId: "safe-user",
    email: "private-beta@example.test",
    workspaceAuthority: "verified",
    workspaceRole: "workspace_owner",
  },
};

const projectLibraryResponse = {
  kind: "project_library",
  status: "authenticated",
  message:
    "Project library is available for this verified session with durable project metadata persistence.",
  activeWorkspaceId: "44444444-4444-4444-8444-444444444444",
  persistence: "durable",
  projects,
};

const forbiddenVisibleTokens = [
  "ownerId",
  "owner_id",
  "workspaceId",
  "workspace_id",
  "44444444-4444-4444-8444-444444444444",
  "Authorization",
  "Bearer ",
  "jwt",
  "database error",
  "PostgREST",
  "storageRef",
  "internalRef",
  "localPath",
  "publicUrl",
  "signedUrl",
  "downloadUrl",
];

const installProjectRoutes = async (page: Page) => {
  const loadedProjectIds: string[] = [];

  await page.route("**/*", async (route) => {
    const url = route.request().url();

    if (
      url.includes("api.openai.com") ||
      url.includes("generativelanguage.googleapis.com") ||
      url.includes("supabase.co/storage") ||
      url.includes("stripe")
    ) {
      throw new Error(`Unexpected external call: ${url}`);
    }

    await route.continue();
  });

  await page.route("**/auth/session", async (route) => {
    await route.fulfill({
      body: JSON.stringify(authSessionResponse),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.route("**/project-library/projects**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathParts = url.pathname.split("/").filter(Boolean);
    const projectId = pathParts.length === 3 ? pathParts[2] : undefined;

    if (request.method() === "GET" && !projectId) {
      await route.fulfill({
        body: JSON.stringify(projectLibraryResponse),
        contentType: "application/json",
        status: 200,
      });
      return;
    }

    if (request.method() === "GET" && projectId) {
      loadedProjectIds.push(projectId);
      await new Promise((resolve) => setTimeout(resolve, 250));

      if (projectId === projects[2].projectId) {
        await route.fulfill({
          body: JSON.stringify({
            kind: "project_library_unavailable",
            status: "repository_unavailable",
            message: "Project persistence is temporarily unavailable.",
          }),
          contentType: "application/json",
          status: 503,
        });
        return;
      }

      const project = projects.find((candidate) => candidate.projectId === projectId);

      await route.fulfill({
        body: JSON.stringify({
          kind: "project_record",
          status: "loaded",
          project,
        }),
        contentType: "application/json",
        status: project ? 200 : 404,
      });
      return;
    }

    throw new Error(`Unexpected project request: ${request.method()} ${url.pathname}`);
  });

  return { loadedProjectIds };
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
};

test.describe("Hosted private beta H6-D.1 project open action", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test("selects projects on the same page with visible safe feedback", async ({
    page,
  }) => {
    const { loadedProjectIds } = await installProjectRoutes(page);

    await page.goto("/projects");

    await expect(page.getByTestId("projects-page")).toBeVisible();
    await expect(page.getByTestId("project-list-panel")).toContainText(
      "North Star Project",
    );
    await expect(page.getByRole("button", { name: "Select" })).toHaveCount(3);

    const firstProjectRow = page
      .locator("li")
      .filter({ hasText: "North Star Project" });
    const secondProjectRow = page
      .locator("li")
      .filter({ hasText: "Second Safe Project" });
    const unavailableProjectRow = page
      .locator("li")
      .filter({ hasText: "Unavailable Project" });

    await firstProjectRow.getByRole("button", { name: "Select" }).click();
    await expect(
      firstProjectRow.getByRole("button", { name: "Selecting..." }),
    ).toBeVisible();

    await expect(firstProjectRow.getByRole("button", { name: "Selected" })).toBeVisible();
    await expect(firstProjectRow).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("project-selection-confirmation")).toContainText(
      "Selected project: North Star Project",
    );
    await expect(page.getByTestId("project-selected-panel")).toContainText(
      "North Star Project",
    );
    await expect(page).toHaveURL(/\/projects$/);

    await secondProjectRow.getByRole("button", { name: "Select" }).click();
    await expect(
      secondProjectRow.getByRole("button", { name: "Selecting..." }),
    ).toBeVisible();
    await expect(secondProjectRow.getByRole("button", { name: "Selected" })).toBeVisible();
    await expect(secondProjectRow).toHaveAttribute("aria-current", "true");
    await expect(firstProjectRow).not.toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("project-selection-confirmation")).toContainText(
      "Selected project: Second Safe Project",
    );

    await unavailableProjectRow.getByRole("button", { name: "Select" }).click();
    await expect(
      unavailableProjectRow.getByRole("button", { name: "Selecting..." }),
    ).toBeVisible();
    await expect(page.getByTestId("project-selection-confirmation")).toContainText(
      "Selected project: Second Safe Project",
    );
    await expect(unavailableProjectRow.getByRole("button", { name: "Select" })).toBeVisible();
    await expect(unavailableProjectRow).not.toHaveAttribute("aria-current", "true");
    await expect(page).toHaveURL(/\/projects$/);

    expect(loadedProjectIds).toEqual([
      projects[0].projectId,
      projects[1].projectId,
      projects[2].projectId,
    ]);
    await expectNoUnsafeVisibleTokens(page);
  });
});
