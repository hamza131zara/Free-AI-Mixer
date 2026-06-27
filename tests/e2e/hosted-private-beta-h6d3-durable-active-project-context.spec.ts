import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import express from "express";
import { expect, test, type Page } from "@playwright/test";
import { createAuthenticatedRequesterContext } from "../../backend/auth/requesterContext";
import type {
  BackendProjectRecord,
  BackendProjectRepository,
} from "../../backend/repositories/repositoryContracts";
import { createProjectHistoryRouter } from "../../backend/routes/projectHistory";

const firstProject = {
  projectId: "11111111-1111-4111-8111-111111111111",
  title: "Durable Active Project",
  status: "active" as const,
  createdAt: "2026-06-27T01:00:00.000Z",
  updatedAt: "2026-06-27T01:00:00.000Z",
};
const secondProject = {
  ...firstProject,
  projectId: "22222222-2222-4222-8222-222222222222",
  title: "Second Durable Project",
};
const workspaceId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";

class ActiveProjectRepository implements BackendProjectRepository {
  activeProjectId: string | null = firstProject.projectId;
  preferenceReadFails = false;
  readonly records: BackendProjectRecord[] = [firstProject, secondProject].map(
    (project) => ({ ...project, ownerId: userId, workspaceId }),
  );

  async createProject(): Promise<BackendProjectRecord> {
    throw new Error("Not used by this focused test.");
  }

  async listProjectsForWorkspace(requestedWorkspaceId: string) {
    return this.records.filter(
      (project) => project.workspaceId === requestedWorkspaceId,
    );
  }

  async getProjectForWorkspace(requestedWorkspaceId: string, projectId: string) {
    return this.records.find(
      (project) =>
        project.workspaceId === requestedWorkspaceId &&
        project.projectId === projectId &&
        project.status === "active",
    );
  }

  async updateProjectTitleForWorkspace() {
    return undefined;
  }

  async getActiveProjectForWorkspaceUser(
    requestedWorkspaceId: string,
    requestedUserId: string,
  ) {
    if (this.preferenceReadFails) {
      throw new Error("raw preference repository detail");
    }

    return requestedUserId === userId && this.activeProjectId
      ? this.getProjectForWorkspace(requestedWorkspaceId, this.activeProjectId)
      : undefined;
  }

  async setActiveProjectForWorkspaceUser(input: {
    projectId: string;
    userId: string;
    workspaceId: string;
  }) {
    const project = await this.getProjectForWorkspace(
      input.workspaceId,
      input.projectId,
    );

    if (project && input.userId === userId) {
      this.activeProjectId = project.projectId;
    }

    return project;
  }

  async clearActiveProjectForWorkspaceUser(
    requestedWorkspaceId: string,
    requestedUserId: string,
  ) {
    if (requestedWorkspaceId === workspaceId && requestedUserId === userId) {
      this.activeProjectId = null;
    }
  }
}

const startServer = async (repository: BackendProjectRepository) => {
  const requester = createAuthenticatedRequesterContext({
    appUserId: userId,
    authProvider: "jwt",
    authSubject: "h6d3-subject",
    userId,
    workspaceAuthority: "verified",
    workspaceId,
  });
  const app = express();
  app.use(express.json());
  app.use(
    createProjectHistoryRouter({
      projectRepository: repository,
      routeAccessResolver: { resolve: async () => requester },
      runtimeConfig: {
        kind: "auth_provider_configured",
        provider: "future_jwt_provider",
      },
    }),
  );
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Focused H6-D.3 server did not expose a port.");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
};

const installFrontendRoutes = async (page: Page) => {
  let activeProjectId: string | null = firstProject.projectId;

  await page.route("**/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "authenticated_session",
        status: "authenticated",
        message: "Backend session verified.",
        identity: {
          userId: "verified-user",
          workspaceAuthority: "verified",
          workspaceRole: "workspace_owner",
        },
      }),
    }),
  );
  await page.route("**/project-library/projects", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "project_library",
        status: "authenticated",
        message: "Durable projects loaded.",
        persistence: "durable",
        activeProjectPreference: { status: "ready", projectId: activeProjectId },
        projects: [firstProject, secondProject],
      }),
    }),
  );
  await page.route("**/project-library/active-project", async (route) => {
    if (route.request().method() === "DELETE") {
      activeProjectId = null;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "active_project",
          status: "cleared",
          activeProject: null,
        }),
      });
      return;
    }

    const body = route.request().postDataJSON() as { projectId: string };
    const project = [firstProject, secondProject].find(
      (candidate) => candidate.projectId === body.projectId,
    );
    activeProjectId = project?.projectId ?? activeProjectId;
    await route.fulfill({
      status: project ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(
        project
          ? { kind: "active_project", status: "selected", activeProject: project }
          : { kind: "project_not_found", status: "not_found" },
      ),
    });
  });
};

test.describe("Hosted private beta H6-D.3 durable active project context", () => {
  test("persists, clears, isolates, and safely degrades active-project preference", async () => {
    const repository = new ActiveProjectRepository();
    const server = await startServer(repository);

    try {
      const list = await fetch(`${server.url}/project-library/projects`);
      expect(await list.json()).toMatchObject({
        status: "authenticated",
        activeProjectPreference: {
          status: "ready",
          projectId: firstProject.projectId,
        },
      });

      const select = await fetch(`${server.url}/project-library/active-project`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "spoofed-user",
          "x-workspace-id": "55555555-5555-4555-8555-555555555555",
        },
        body: JSON.stringify({ projectId: secondProject.projectId }),
      });
      expect(select.status).toBe(200);
      expect(await select.json()).toMatchObject({
        kind: "active_project",
        status: "selected",
        activeProject: { projectId: secondProject.projectId },
      });

      const unknown = await fetch(`${server.url}/project-library/active-project`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "66666666-6666-4666-8666-666666666666",
        }),
      });
      expect(unknown.status).toBe(404);

      const cleared = await fetch(
        `${server.url}/project-library/active-project`,
        { method: "DELETE" },
      );
      expect(cleared.status).toBe(200);
      expect(await cleared.json()).toEqual({
        kind: "active_project",
        status: "cleared",
        activeProject: null,
      });
      expect(repository.activeProjectId).toBeNull();

      repository.preferenceReadFails = true;
      const degraded = await fetch(`${server.url}/project-library/projects`);
      const degradedBody = await degraded.json();
      expect(degraded.status).toBe(200);
      expect(degradedBody).toMatchObject({
        projects: expect.any(Array),
        activeProjectPreference: {
          status: "persistence_unavailable",
          projectId: null,
        },
      });
      expect(JSON.stringify(degradedBody)).not.toContain("raw preference");
    } finally {
      await server.close();
    }
  });

  test("restores plain Projects and Mixer routes from the verified server preference", async ({
    page,
  }) => {
    await installFrontendRoutes(page);

    await page.goto("/projects");
    await expect(page.getByRole("button", { name: "Selected" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`projectId=${firstProject.projectId}$`));

    await page.goto("/mixer");
    await expect(page.getByTestId("mixer-project-context")).toContainText(
      `Verified project context: ${firstProject.title}`,
    );

    await page.goto(`/projects?projectId=${secondProject.projectId}`);
    await expect(page.getByTestId("project-selection-confirmation")).toContainText(
      secondProject.title,
    );

    const storage = await page.evaluate(() =>
      JSON.stringify({
        localStorage: { ...window.localStorage },
        sessionStorage: { ...window.sessionStorage },
      }),
    );
    expect(storage).not.toContain(firstProject.projectId);
    expect(storage).not.toContain(secondProject.projectId);
  });

  test("keeps bearer paths exact and clears only runtime project context on logout", () => {
    const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
    const authenticatedFetch = read("src/services/auth/authenticatedFetch.ts");
    const projectStore = read("src/store/projectLibraryStore.ts");
    const authStore = read("src/store/authStore.ts");
    const migration = read(
      "backend/db/migrations/0007_h6d3_workspace_user_active_project_preference.sql",
    );

    expect(authenticatedFetch).toContain(
      'const activeProjectPreferencePath = "/project-library/active-project"',
    );
    expect(authenticatedFetch).toContain('method === "PUT" || method === "DELETE"');
    expect(authenticatedFetch).not.toContain("/project-library/*");
    expect(projectStore).toContain("requestEpoch");
    expect(projectStore).toContain("clearRuntimeProjectContext");
    expect(authStore).toContain("clearRuntimeProjectContext");
    expect(authStore).not.toContain("clearActiveProject()");
    expect(migration).toContain("workspace_user_preferences");
    expect(migration).toContain("revoke all on table");
    expect(migration).toContain("to service_role");
  });
});
