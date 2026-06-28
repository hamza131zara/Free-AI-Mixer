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

const workspaceId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const activeProjectId = "33333333-3333-4333-8333-333333333333";
const unrelatedProjectId = "44444444-4444-4444-8444-444444444444";
const archivedProjectId = "55555555-5555-4555-8555-555555555555";
const deletedProjectId = "66666666-6666-4666-8666-666666666666";
const crossWorkspaceProjectId = "77777777-7777-4777-8777-777777777777";

const project = (
  projectId: string,
  title: string,
  status: BackendProjectRecord["status"] = "active",
  ownerWorkspaceId = workspaceId,
): BackendProjectRecord => ({
  projectId,
  title,
  status,
  ownerId: userId,
  workspaceId: ownerWorkspaceId,
  createdAt: "2026-06-27T01:00:00.000Z",
  updatedAt: "2026-06-27T01:00:00.000Z",
});

class SoftDeleteRepository implements BackendProjectRepository {
  readonly records = new Map<string, BackendProjectRecord>([
    [activeProjectId, project(activeProjectId, "Delete Me")],
    [unrelatedProjectId, project(unrelatedProjectId, "Keep Me")],
    [archivedProjectId, project(archivedProjectId, "Archived", "archived")],
    [deletedProjectId, project(deletedProjectId, "Already Deleted", "deleted")],
    [
      crossWorkspaceProjectId,
      project(
        crossWorkspaceProjectId,
        "Other Workspace",
        "active",
        "88888888-8888-4888-8888-888888888888",
      ),
    ],
  ]);
  readonly preferences = new Map<string, string | null>([
    [`${workspaceId}:${userId}`, activeProjectId],
    [`${workspaceId}:99999999-9999-4999-8999-999999999999`, activeProjectId],
    [`${workspaceId}:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`, unrelatedProjectId],
  ]);
  throwOnDelete = false;
  deleteOutcomeOverride?: "forbidden" | "not_found";
  invalidDeleteResult?: "undefined" | "null" | "unexpected";
  selectionOutcome: "selected" | "forbidden" | "not_found" = "selected";

  async createProject(): Promise<BackendProjectRecord> {
    throw new Error("Not used in H6-D.4.");
  }

  async listProjectsForWorkspace(requestedWorkspaceId: string) {
    return [...this.records.values()].filter(
      (record) =>
        record.workspaceId === requestedWorkspaceId && record.status === "active",
    );
  }

  async getProjectForWorkspace(requestedWorkspaceId: string, projectId: string) {
    const record = this.records.get(projectId);
    return record?.workspaceId === requestedWorkspaceId && record.status === "active"
      ? record
      : undefined;
  }

  async updateProjectTitleForWorkspace() {
    return undefined;
  }

  async getActiveProjectForWorkspaceUser(requestedWorkspaceId: string, requestedUserId: string) {
    const projectId = this.preferences.get(`${requestedWorkspaceId}:${requestedUserId}`);
    return projectId
      ? this.getProjectForWorkspace(requestedWorkspaceId, projectId)
      : undefined;
  }

  async setActiveProjectForWorkspaceUser(input: {
    projectId: string;
    userId: string;
    workspaceId: string;
  }) {
    if (this.selectionOutcome === "forbidden") {
      return { status: "forbidden" as const };
    }

    if (this.selectionOutcome === "not_found") {
      return { status: "not_found" as const };
    }

    const record = await this.getProjectForWorkspace(input.workspaceId, input.projectId);
    if (!record) {
      return { status: "not_found" as const };
    }

    this.preferences.set(`${input.workspaceId}:${input.userId}`, input.projectId);
    return { status: "selected" as const, project: record };
  }

  async clearActiveProjectForWorkspaceUser(requestedWorkspaceId: string, requestedUserId: string) {
    this.preferences.set(`${requestedWorkspaceId}:${requestedUserId}`, null);
  }

  async softDeleteProjectForWorkspaceUser(input: {
    projectId: string;
    userId: string;
    workspaceId: string;
  }): Promise<"deleted" | "forbidden" | "not_found"> {
    if (this.throwOnDelete) {
      throw new Error("raw database transaction detail");
    }

    if (this.invalidDeleteResult === "undefined") {
      return undefined as never;
    }

    if (this.invalidDeleteResult === "null") {
      return null as never;
    }

    if (this.invalidDeleteResult === "unexpected") {
      return "unexpected" as never;
    }

    if (this.deleteOutcomeOverride) {
      return this.deleteOutcomeOverride;
    }

    if (input.userId !== userId) {
      return "forbidden";
    }
    const record = await this.getProjectForWorkspace(input.workspaceId, input.projectId);
    if (!record) {
      return "not_found";
    }
    for (const [key, projectId] of this.preferences) {
      if (key.startsWith(`${input.workspaceId}:`) && projectId === input.projectId) {
        this.preferences.set(key, null);
      }
    }
    this.records.set(input.projectId, { ...record, status: "deleted" });
    return "deleted";
  }
}

const startServer = async (
  repository: SoftDeleteRepository,
  workspaceRole: string,
) => {
  const app = express();
  app.use(express.json());
  app.use(
    createProjectHistoryRouter({
      projectRepository: repository,
      routeAccessResolver: {
        resolve: async () =>
          createAuthenticatedRequesterContext({
            appUserId: userId,
            authProvider: "jwt",
            authSubject: "h6d4-subject",
            userId,
            workspaceAuthority: "verified",
            workspaceId,
            workspaceRole,
          }),
      },
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
    throw new Error("H6-D.4 test server did not expose a port.");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
};

const deleteFrom = (url: string, projectId: string) =>
  fetch(`${url}/project-library/projects/${projectId}`, { method: "DELETE" });

test.describe("H6-D.4 transactional project soft deletion", () => {
  test("allows owners/admins, clears matching preferences, and preserves unrelated state", async () => {
    for (const role of ["workspace_owner", "workspace_admin"]) {
      const repository = new SoftDeleteRepository();
      const server = await startServer(repository, role);
      try {
        const listResponse = await fetch(`${server.url}/project-library/projects`);
        expect(await listResponse.json()).toMatchObject({
          capabilities: { canDeleteProjects: true },
        });
        const response = await deleteFrom(server.url, activeProjectId);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          kind: "project_deleted",
          status: "deleted",
          projectId: activeProjectId,
        });
        expect(repository.preferences.get(`${workspaceId}:${userId}`)).toBeNull();
        expect(
          repository.preferences.get(
            `${workspaceId}:99999999-9999-4999-8999-999999999999`,
          ),
        ).toBeNull();
        expect(
          repository.preferences.get(
            `${workspaceId}:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
          ),
        ).toBe(unrelatedProjectId);
        expect(repository.records.get(unrelatedProjectId)?.status).toBe("active");
        expect((await deleteFrom(server.url, activeProjectId)).status).toBe(404);
      } finally {
        await server.close();
      }
    }
  });

  test("denies members/viewers and safely maps invalid, hidden, and failed transactions", async () => {
    for (const role of ["workspace_member", "workspace_viewer"]) {
      const server = await startServer(new SoftDeleteRepository(), role);
      try {
        const listResponse = await fetch(`${server.url}/project-library/projects`);
        expect(await listResponse.json()).toMatchObject({
          capabilities: { canDeleteProjects: false },
        });
        expect((await deleteFrom(server.url, activeProjectId)).status).toBe(403);
      } finally {
        await server.close();
      }
    }

    const repository = new SoftDeleteRepository();
    const server = await startServer(repository, "workspace_owner");
    try {
      expect((await deleteFrom(server.url, "not-a-uuid")).status).toBe(400);
      const hiddenStatuses = await Promise.all(
        [
          "99999999-9999-4999-8999-999999999998",
          crossWorkspaceProjectId,
          archivedProjectId,
          deletedProjectId,
        ].map(async (projectId) => (await deleteFrom(server.url, projectId)).status),
      );
      expect(hiddenStatuses).toEqual([404, 404, 404, 404]);

      repository.throwOnDelete = true;
      const unavailable = await deleteFrom(server.url, activeProjectId);
      expect(unavailable.status).toBe(503);
      expect(await unavailable.text()).not.toContain("raw database");
    } finally {
      await server.close();
    }
  });

  test("maps exact delete outcomes and rejects malformed repository results", async () => {
    for (const [outcome, expectedStatus] of [
      ["forbidden", 403],
      ["not_found", 404],
    ] as const) {
      const repository = new SoftDeleteRepository();
      repository.deleteOutcomeOverride = outcome;
      const server = await startServer(repository, "workspace_owner");

      try {
        expect((await deleteFrom(server.url, activeProjectId)).status).toBe(
          expectedStatus,
        );
      } finally {
        await server.close();
      }
    }

    for (const invalidResult of ["undefined", "null", "unexpected"] as const) {
      const repository = new SoftDeleteRepository();
      repository.invalidDeleteResult = invalidResult;
      const server = await startServer(repository, "workspace_owner");

      try {
        const response = await deleteFrom(server.url, activeProjectId);
        const responseText = await response.text();
        expect(response.status).toBe(503);
        expect(responseText).not.toContain(invalidResult);
        expect(responseText).not.toContain("invalid status");
        expect(responseText).not.toContain("Project soft-delete repository");
      } finally {
        await server.close();
      }
    }
  });

  test("uses invoker RPCs, exact privileges, consistent locks, and no destructive SQL", () => {
    const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
    const migration = read(
      "backend/db/migrations/0008_h6d4_transactional_project_soft_delete.sql",
    ).replace(/\r\n/g, "\n");
    const projectRoute = read("backend/routes/projectHistory.ts");
    const repository = read("backend/repositories/supabaseProjectRepository.ts");
    const generation = read("backend/routes/generation.ts");
    const authenticatedFetch = read("src/services/auth/authenticatedFetch.ts");
    const projectService = read("src/services/projectLibraryService.ts");
    const projectStore = read("src/store/projectLibraryStore.ts");
    const combined = `${migration}\n${repository}`;

    expect(migration.trimStart().startsWith("begin;")).toBe(true);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(migration).toContain(
      "grant select on table public.workspace_memberships to service_role;",
    );
    expect(migration).toContain(
      "grant update (updated_at)\non table public.workspace_memberships\nto service_role;",
    );
    expect(migration).not.toMatch(
      /grant\s+update\s+on\s+table\s+public\.workspace_memberships/i,
    );
    expect(projectRoute).toContain('if (result !== "deleted")');
    expect(projectRoute).toContain(
      "Project soft-delete repository returned an invalid status.",
    );
    expect(migration.match(/security invoker/g)).toHaveLength(2);
    expect(migration).not.toContain("security definer");
    expect(migration.match(/set search_path = pg_catalog/g)).toHaveLength(2);
    expect(migration).not.toContain("set search_path = pg_catalog, public");
    expect(migration).not.toMatch(/create\s+or\s+replace\s+function/i);
    expect(migration).not.toContain("if not exists");
    expect(migration).toMatch(
      /alter table public\.projects\s+add constraint projects_deleted_state_check/i,
    );
    expect(migration.match(/create function public\./g)).toHaveLength(2);
    expect(migration).toContain("status is not null");
    expect(migration).toContain("projects_deleted_state_check already exists");
    expect(migration).toContain(
      "set_active_project_for_workspace_user(uuid,uuid,uuid) already exists",
    );
    expect(migration).toContain(
      "soft_delete_project_for_workspace_user(uuid,uuid,uuid) already exists",
    );
    expect(migration).toContain("for share");
    expect(migration.match(/for update/g)).toHaveLength(2);
    expect(migration).toContain("set active_project_id = null");
    expect(migration).toContain("status = 'deleted'");
    expect(migration).toContain("deleted_at = v_now");
    expect(migration).toContain("from public, anon, authenticated, service_role");
    expect(migration).toContain("to service_role");
    expect(migration).not.toMatch(/delete\s+from\s+public\./i);
    expect(repository).toContain('"set_active_project_for_workspace_user"');
    expect(repository).toContain('"soft_delete_project_for_workspace_user"');
    const selectionMethod = repository.slice(
      repository.indexOf("async setActiveProjectForWorkspaceUser"),
      repository.indexOf("async softDeleteProjectForWorkspaceUser"),
    );
    expect(selectionMethod).toContain("this.client.rpc");
    expect(selectionMethod).toContain('result.data === "forbidden"');
    expect(selectionMethod).toContain('result.data === "not_found"');
    expect(selectionMethod).toContain('result.data !== "selected"');
    expect(selectionMethod).not.toContain(".upsert(");
    expect(repository).not.toMatch(/\bupsert\??\s*\(/);
    expect(generation).toContain("getProjectForWorkspace");
    expect(authenticatedFetch).toContain("projectLibraryProjectRecordPathPattern");
    expect(projectService).toContain("fetchWithOptionalAccountBearer");
    expect(projectService).toContain("payload.projectId === projectId");
    expect(projectService).toContain(
      "Project deletion response could not be verified.",
    );
    expect(projectStore).toContain(
      "(project) => project.projectId !== projectId",
    );
    expect(projectService).not.toContain('headers.set("Authorization"');
    expect(projectService).not.toContain("supabase.storage");
    expect(combined).not.toContain("localStorage");
    expect(combined).not.toContain("sessionStorage");
  });
});

const frontendProjects = [
  {
    projectId: activeProjectId,
    title: "Delete Me",
    status: "active",
    createdAt: "2026-06-27T01:00:00.000Z",
    updatedAt: "2026-06-27T01:00:00.000Z",
  },
  {
    projectId: unrelatedProjectId,
    title: "Keep Me",
    status: "active",
    createdAt: "2026-06-27T02:00:00.000Z",
    updatedAt: "2026-06-27T02:00:00.000Z",
  },
];

const installUiRoutes = async (page: Page, initialCanDeleteProjects: boolean) => {
  let projects = [...frontendProjects];
  let active: string | null = activeProjectId;
  let canDeleteProjects = initialCanDeleteProjects;
  let projectAccess: "authenticated" | "unauthenticated" = "authenticated";
  let deleteRequests = 0;
  let projectListUnavailable = false;
  let deleteResponseProjectId: string | undefined;
  let releaseDelete: (() => void) | undefined;
  let deleteGate = new Promise<void>((resolve) => {
    releaseDelete = resolve;
  });

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
          workspaceRole: initialCanDeleteProjects
            ? "workspace_owner"
            : "workspace_member",
        },
      }),
    }),
  );
  await page.route("**/project-library/projects**", async (route) => {
    const url = new URL(route.request().url());
    const id = url.pathname.split("/").at(-1);
    if (route.request().method() === "DELETE") {
      deleteRequests += 1;
      await deleteGate;
      projects = projects.filter((project) => project.projectId !== id);
      if (active === id) active = null;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "project_deleted",
          status: "deleted",
          projectId: deleteResponseProjectId ?? id,
        }),
      });
      return;
    }

    if (projectListUnavailable) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "project_library_unavailable",
          status: "repository_unavailable",
          message: "Project persistence is temporarily unavailable.",
        }),
      });
      return;
    }

    if (projectAccess === "unauthenticated") {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "project_library_sign_in_required",
          status: "unauthenticated",
          reason: "missing_credentials",
          message: "Sign in is required to access saved projects.",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "project_library",
        status: "authenticated",
        message: "Projects loaded.",
        persistence: "durable",
        capabilities: { canDeleteProjects },
        activeProjectPreference: { status: "ready", projectId: active },
        projects,
      }),
    });
  });
  await page.route("**/project-library/active-project", async (route) => {
    const body = route.request().postDataJSON() as { projectId?: string };
    const selected = projects.find((project) => project.projectId === body.projectId);
    if (selected) active = selected.projectId;
    await route.fulfill({
      status: selected ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(
        selected
          ? { kind: "active_project", status: "selected", activeProject: selected }
          : { kind: "project_not_found", status: "not_found" },
      ),
    });
  });

  return {
    deleteRequests: () => deleteRequests,
    releaseDelete: () => releaseDelete?.(),
    setDeleteResponseProjectId: (projectId?: string) => {
      deleteResponseProjectId = projectId;
    },
    setProjectListUnavailable: (unavailable: boolean) => {
      projectListUnavailable = unavailable;
    },
    setProjectAccess: (access: "authenticated" | "unauthenticated") => {
      projectAccess = access;
    },
    setCanDeleteProjects: (allowed: boolean) => {
      canDeleteProjects = allowed;
    },
    deleteInOtherTab: () => {
      projects = projects.filter((project) => project.projectId !== activeProjectId);
      active = null;
      deleteGate = Promise.resolve();
    },
    restoreActiveProject: () => {
      projects = [...frontendProjects];
      active = activeProjectId;
    },
  };
};

test("requires confirmation, avoids optimistic removal, and reconciles another-tab deletion", async ({
  page,
}) => {
  const routes = await installUiRoutes(page, true);
  await page.goto(`/projects?projectId=${activeProjectId}`);
  const row = page.locator("li").filter({ hasText: "Delete Me" });

  await row.getByRole("button", { name: "Delete project" }).click();
  const dialog = page.getByTestId("project-delete-confirmation");
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();
  await dialog.press("Escape");
  await expect(row.getByRole("button", { name: "Delete project" })).toBeFocused();
  expect(routes.deleteRequests()).toBe(0);

  await row.getByRole("button", { name: "Delete project" }).click();
  await page.getByRole("button", { name: "Confirm delete project" }).click();
  await expect(row).toBeVisible();
  routes.releaseDelete();
  await expect(row).toHaveCount(0);
  await expect(
    page
      .locator("li")
      .filter({ hasText: "Keep Me" })
      .getByRole("button", { name: "Delete project" }),
  ).toBeFocused();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("button", { name: "Selected" })).toHaveCount(0);
  await expect(page.getByText("Keep Me")).toBeVisible();

  routes.restoreActiveProject();
  await page.goto(`/projects?projectId=${activeProjectId}`);
  await expect(page.getByRole("button", { name: "Selected" })).toBeVisible();
  routes.deleteInOtherTab();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("button", { name: "Selected" })).toHaveCount(0);

  const browserStorage = await page.evaluate(() =>
    JSON.stringify({ ...window.localStorage, ...window.sessionStorage }),
  );
  expect(browserStorage).not.toContain(activeProjectId);
});

test("closes a stale confirmation after verified removal without deleting again", async ({
  page,
}) => {
  const routes = await installUiRoutes(page, true);
  await page.goto(`/projects?projectId=${activeProjectId}`);
  const staleRow = page.locator("li").filter({ hasText: "Delete Me" });

  await staleRow.getByRole("button", { name: "Delete project" }).click();
  await expect(page.getByTestId("project-delete-confirmation")).toBeFocused();

  routes.deleteInOtherTab();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));

  await expect(page.getByTestId("project-delete-confirmation")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirm delete project" })).toHaveCount(0);
  await expect(page.getByText("Delete Me")).toHaveCount(0);
  expect(routes.deleteRequests()).toBe(0);
  await expect(
    page
      .locator("li")
      .filter({ hasText: "Keep Me" })
      .getByRole("button", { name: "Delete project" }),
  ).toBeFocused();
});

test("clears confirmation content immediately when project access becomes unauthenticated", async ({
  page,
}) => {
  const routes = await installUiRoutes(page, true);
  await page.goto(`/projects?projectId=${activeProjectId}`);
  await page
    .locator("li")
    .filter({ hasText: "Delete Me" })
    .getByRole("button", { name: "Delete project" })
    .click();

  routes.setProjectAccess("unauthenticated");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));

  await expect(page.getByTestId("project-delete-confirmation")).toHaveCount(0);
  await expect(page.getByText("Delete Me")).toHaveCount(0);
  await expect(page.getByTestId("protected-route-shell-status")).toContainText(
    "Sign in required",
  );
  expect(routes.deleteRequests()).toBe(0);
});

test("closes confirmation when delete capability is revoked", async ({ page }) => {
  const routes = await installUiRoutes(page, true);
  await page.goto(`/projects?projectId=${activeProjectId}`);
  await page
    .locator("li")
    .filter({ hasText: "Delete Me" })
    .getByRole("button", { name: "Delete project" })
    .click();

  routes.setCanDeleteProjects(false);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));

  await expect(page.getByTestId("project-delete-confirmation")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete project" })).toHaveCount(0);
  await expect(page.getByTestId("project-list-panel")).toBeFocused();
  expect(routes.deleteRequests()).toBe(0);
});

test("blocks unrelated project mutations while confirmation is open", async ({ page }) => {
  const routes = await installUiRoutes(page, true);
  await page.goto(`/projects?projectId=${activeProjectId}`);
  await page
    .locator("li")
    .filter({ hasText: "Delete Me" })
    .getByRole("button", { name: "Delete project" })
    .click();

  await expect(page.getByTestId("project-delete-confirmation")).toBeVisible();
  await expect(page.getByTestId("project-delete-confirmation")).not.toHaveAttribute(
    "aria-modal",
  );
  await expect(page.getByLabel("Project title")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Create Project" })).toBeDisabled();
  const selectionButtons = page.getByRole("button", {
    name: /^(Select|Selected)$/,
  });
  await expect(selectionButtons).toHaveCount(2);
  for (const button of await selectionButtons.all()) {
    await expect(button).toBeDisabled();
  }
  await expect(page.getByLabel("Rename project")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Rename Project" })).toBeDisabled();
 const deleteButtons = page
  .getByTestId("project-list-panel")
  .getByRole("button", {
    name: "Delete project",
    exact: true,
  });

await expect(deleteButtons).toHaveCount(2);

for (const button of await deleteButtons.all()) {
  await expect(button).toBeDisabled();
}
  await expect(page.getByRole("button", { name: "Cancel" })).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Confirm delete project" }),
  ).toBeEnabled();
  expect(routes.deleteRequests()).toBe(0);
});

test("rejects a mismatched deletion response without removing project state", async ({
  page,
}) => {
  const routes = await installUiRoutes(page, true);
  routes.setDeleteResponseProjectId(unrelatedProjectId);
  await page.goto(`/projects?projectId=${activeProjectId}`);
  const row = page.locator("li").filter({ hasText: "Delete Me" });

  await row.getByRole("button", { name: "Delete project" }).click();
  await page.getByRole("button", { name: "Confirm delete project" }).click();
  routes.releaseDelete();

  await expect(row).toBeVisible();
  await expect(page).toHaveURL(
    new RegExp(`/projects\\?projectId=${activeProjectId}$`),
  );
  await expect(page.getByTestId("projects-access-state")).toContainText(
    "Project deletion response could not be verified.",
  );
});

test("preserves Projects projectId during outage and clears it only after verified absence", async ({
  page,
}) => {
  const routes = await installUiRoutes(page, true);
  await page.goto(`/projects?projectId=${activeProjectId}`);
  await expect(page.getByRole("button", { name: "Selected" })).toBeVisible();

  routes.setProjectListUnavailable(true);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page).toHaveURL(
    new RegExp(`/projects\\?projectId=${activeProjectId}$`),
  );
  await expect(page.getByTestId("projects-access-state")).toContainText(
    "Project persistence is temporarily unavailable.",
  );

  routes.deleteInOtherTab();
  routes.setProjectListUnavailable(false);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page).toHaveURL(/\/projects$/);
});

test("hides deletion without backend capability", async ({ page }) => {
  await installUiRoutes(page, false);
  await page.goto("/projects");
  await expect(page.getByRole("button", { name: "Delete project" })).toHaveCount(0);
});

test("reconciles another-tab deletion on Mixer without selecting a fallback", async ({
  page,
}) => {
  const routes = await installUiRoutes(page, true);
  await page.goto(`/mixer?projectId=${activeProjectId}`);
  await expect(page.getByTestId("mixer-project-context")).toContainText(
    "Verified project context: Delete Me",
  );

  routes.deleteInOtherTab();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));

  await expect(page).toHaveURL(/\/mixer$/);
  await expect(page.getByTestId("mixer-project-context")).toContainText(
    "Select a saved project",
  );
  await expect(page.getByRole("button", { name: "Generate Image" })).toBeDisabled();
  await expect(page.getByTestId("mixer-project-context")).not.toContainText("Keep Me");
});

test("preserves Mixer projectId and disables generation during repository outage", async ({
  page,
}) => {
  const routes = await installUiRoutes(page, true);
  await page.goto(`/mixer?projectId=${activeProjectId}`);
  await expect(page.getByTestId("mixer-project-context")).toContainText(
    "Verified project context: Delete Me",
  );

  routes.setProjectListUnavailable(true);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));

  await expect(page).toHaveURL(
    new RegExp(`/mixer\\?projectId=${activeProjectId}$`),
  );
  await expect(page.getByTestId("mixer-project-context")).toContainText(
    "Project persistence is temporarily unavailable.",
  );
  await expect(page.getByRole("button", { name: "Generate Image" })).toBeDisabled();
});
