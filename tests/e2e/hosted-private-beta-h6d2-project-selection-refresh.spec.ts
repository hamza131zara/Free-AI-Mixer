import { expect, test, type Page } from "@playwright/test";

const projects = [
  {
    projectId: "11111111-1111-4111-8111-111111111111",
    title: "Refresh Persistent Project",
    status: "active",
    createdAt: "2026-06-25T01:00:00.000Z",
    updatedAt: "2026-06-25T01:00:00.000Z",
  },
  {
    projectId: "22222222-2222-4222-8222-222222222222",
    title: "Second Refresh Project",
    status: "active",
    createdAt: "2026-06-25T02:00:00.000Z",
    updatedAt: "2026-06-25T02:00:00.000Z",
  },
] as const;

const authenticatedSession = {
  kind: "authenticated_session",
  status: "authenticated",
  message: "Backend session verified.",
  identity: {
    userId: "verified-user-001",
    workspaceAuthority: "verified",
    workspaceRole: "workspace_owner",
  },
};

const unauthenticatedSession = {
  kind: "unauthenticated_session",
  status: "unauthenticated",
  reason: "missing_credentials",
  message: "Sign in is required before protected account routes can show verified data.",
};

const installProjectRoutes = async (page: Page) => {
  let authenticated = true;
  let visibleProjects: typeof projects[number][] = [...projects];
  const loadedProjectIds: string[] = [];

  await page.route("**/auth/session", async (route) => {
    await route.fulfill({
      body: JSON.stringify(authenticated ? authenticatedSession : unauthenticatedSession),
      contentType: "application/json",
      status: authenticated ? 200 : 200,
    });
  });

  await page.route("**/project-library/projects**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathParts = url.pathname.split("/").filter(Boolean);
    const projectId = pathParts.length === 3 ? pathParts[2] : undefined;

    if (request.method() === "GET" && !projectId) {
      await route.fulfill({
        body: JSON.stringify({
          kind: "project_library",
          status: "authenticated",
          message:
            "Project library is available for this verified session with durable project metadata persistence.",
          persistence: "durable",
          projects: visibleProjects,
        }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }

    if (request.method() === "GET" && projectId) {
      loadedProjectIds.push(projectId);
      const project = visibleProjects.find(
        (candidate) => candidate.projectId === projectId,
      );

      await route.fulfill({
        body: JSON.stringify(
          project
            ? {
                kind: "project_record",
                status: "loaded",
                project,
              }
            : {
                kind: "project_not_found",
                status: "not_found",
                message: "Project was not found for this workspace.",
              },
        ),
        contentType: "application/json",
        status: project ? 200 : 404,
      });
      return;
    }

    throw new Error(`Unexpected project request: ${request.method()} ${url.pathname}`);
  });

  return {
    getLoadedProjectIds: () => [...loadedProjectIds],
    setAuthenticated: (nextAuthenticated: boolean) => {
      authenticated = nextAuthenticated;
    },
    setVisibleProjects: (nextProjects: typeof projects[number][]) => {
      visibleProjects = nextProjects;
    },
  };
};

const rowForProject = (page: Page, title: string) =>
  page.locator("li").filter({ hasText: title });

const expectNoProjectSelectionInBrowserStorage = async (page: Page) => {
  const browserStorage = await page.evaluate(() =>
    JSON.stringify({
      localStorage: { ...window.localStorage },
      sessionStorage: { ...window.sessionStorage },
    }),
  );

  for (const project of projects) {
    expect(browserStorage).not.toContain(project.projectId);
    expect(browserStorage).not.toContain(project.title);
  }
};

test.describe("Hosted private beta H6-D.2 project selection refresh persistence", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test("persists selection through the URL only after verified project-list restoration", async ({
    page,
  }) => {
    const routes = await installProjectRoutes(page);

    await page.goto("/projects");
    const firstProjectRow = rowForProject(page, projects[0].title);
    const secondProjectRow = rowForProject(page, projects[1].title);

    await firstProjectRow.getByRole("button", { name: "Select" }).click();
    await expect(firstProjectRow.getByRole("button", { name: "Selected" })).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`/projects\\?projectId=${projects[0].projectId}$`),
    );
    await expect(page.getByTestId("project-selected-panel")).toContainText(
      `Selected project: ${projects[0].title}`,
    );

    await page.reload({ waitUntil: "load" });
    await expect(firstProjectRow.getByRole("button", { name: "Selected" })).toBeVisible();
    await expect(page.getByTestId("project-selected-panel")).toContainText(
      `Selected project: ${projects[0].title}`,
    );
    await expect(page.getByRole("button", { name: "Use in Mixer" })).toBeVisible();

    await secondProjectRow.getByRole("button", { name: "Select" }).click();
    await expect(secondProjectRow.getByRole("button", { name: "Selected" })).toBeVisible();
    await expect(firstProjectRow.getByRole("button", { name: "Select" })).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`/projects\\?projectId=${projects[1].projectId}$`),
    );
    await expect(page.getByTestId("project-selected-panel")).toContainText(
      `Selected project: ${projects[1].title}`,
    );

    expect(routes.getLoadedProjectIds()).toEqual(
      expect.arrayContaining([projects[0].projectId, projects[1].projectId]),
    );
    await expectNoProjectSelectionInBrowserStorage(page);
  });

  test("ignores invalid unknown and unauthorized project IDs instead of trusting the URL", async ({
    page,
  }) => {
    const routes = await installProjectRoutes(page);

    await page.goto("/projects?projectId=not-a-project");
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("button", { name: "Selected" })).toHaveCount(0);
    await expect(page.getByTestId("project-selected-panel")).not.toContainText(
      "Selected project:",
    );

    await page.goto("/projects?projectId=33333333-3333-4333-8333-333333333333");
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("button", { name: "Selected" })).toHaveCount(0);
    await expect(page.getByTestId("project-selected-panel")).not.toContainText(
      "Selected project:",
    );

    routes.setVisibleProjects([projects[1]]);
    await page.goto(`/projects?projectId=${projects[0].projectId}`);
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("button", { name: "Selected" })).toHaveCount(0);
    await expect(page.getByTestId("project-selected-panel")).not.toContainText(
      projects[0].title,
    );
    await expectNoProjectSelectionInBrowserStorage(page);
  });

  test("keeps return path safe across logout and restores only after authenticated list verification", async ({
    page,
  }) => {
    const routes = await installProjectRoutes(page);

    await page.goto("/projects");
    await rowForProject(page, projects[0].title)
      .getByRole("button", { name: "Select" })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/projects\\?projectId=${projects[0].projectId}$`),
    );

    routes.setAuthenticated(false);
    await page.reload({ waitUntil: "load" });
    await expect(page.getByTestId("protected-route-shell")).toBeVisible();
    await expect(page.getByRole("button", { name: "Selected" })).toHaveCount(0);

    routes.setAuthenticated(true);
    await page.goto(`/projects?projectId=${projects[0].projectId}`);
    await expect(
      rowForProject(page, projects[0].title).getByRole("button", { name: "Selected" }),
    ).toBeVisible();
    await expect(page.getByTestId("project-selected-panel")).toContainText(
      `Selected project: ${projects[0].title}`,
    );

    routes.setVisibleProjects([projects[1]]);
    await page.goto(`/projects?projectId=${projects[0].projectId}`);
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("button", { name: "Selected" })).toHaveCount(0);
    await expect(page.getByTestId("project-selected-panel")).not.toContainText(
      projects[0].title,
    );
    await expectNoProjectSelectionInBrowserStorage(page);
  });
});
