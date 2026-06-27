import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import express from "express";
import { expect, test } from "@playwright/test";
import {
  createAuthenticatedRequesterContext,
  createUnauthenticatedRequesterContext,
} from "../../backend/auth/requesterContext";
import type {
  BackendProjectRecord,
  BackendProjectRepository,
} from "../../backend/repositories/repositoryContracts";
import { createProjectHistoryRouter } from "../../backend/routes/projectHistory";
import { createNotConfiguredProductionSupabasePersistenceWriter } from "../../backend/persistence/productionSupabasePersistenceBoundary";

const runtimeConfig = {
  kind: "auth_provider_configured" as const,
  provider: "future_jwt_provider" as const,
};

const requester = createAuthenticatedRequesterContext({
  appUserId: "11111111-1111-4111-8111-111111111111",
  authProvider: "jwt",
  authSubject: "h6d-subject",
  userId: "11111111-1111-4111-8111-111111111111",
  workspaceAuthority: "verified",
  workspaceId: "22222222-2222-4222-8222-222222222222",
});

const unverifiedWorkspaceRequester = createAuthenticatedRequesterContext({
  appUserId: "11111111-1111-4111-8111-111111111111",
  authProvider: "jwt",
  authSubject: "h6d-subject",
  userId: "11111111-1111-4111-8111-111111111111",
  workspaceAuthority: "not_available",
  workspaceAuthorityReason: "no_verified_workspace",
});

const otherWorkspaceId = "33333333-3333-4333-8333-333333333333";

const readProjectFile = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

const expectSensitiveProjectHeaders = (response: Response) => {
  expect(response.headers.get("Cache-Control")).toBe(
    "private, no-store, max-age=0, must-revalidate",
  );
  expect(response.headers.get("Pragma")).toBe("no-cache");
  expect(response.headers.get("Expires")).toBe("0");
  expect(response.headers.get("ETag")).toBeNull();
};

const expectNoUnsafeFields = (value: unknown) => {
  const serialized = JSON.stringify(value);

  for (const forbidden of [
    "ownerId",
    "owner_id",
    "workspace_id",
    "service-role",
    "service_role",
    "Authorization",
    "Bearer ",
    "encrypted_payload",
    "secret_ref",
    "storage_ref",
    "object_key",
    "local_path",
    "base64",
    "bytes",
    "public_url",
    "signed_url",
    "download_url",
    "PostgREST",
    "duplicate key",
    "stack",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

class InMemoryProjectRepository implements BackendProjectRepository {
  readonly records = new Map<string, BackendProjectRecord>();
  readonly activeProjects = new Map<string, string>();
  shouldThrow = false;
  private tick = 0;

  async createProject(input: {
    ownerId: string;
    projectId: string;
    title: string;
    workspaceId: string;
  }): Promise<BackendProjectRecord> {
    this.throwIfRequested();
    const now = this.nextTimestamp();
    const project: BackendProjectRecord = {
      projectId: input.projectId,
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
      title: input.title,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    this.records.set(project.projectId, project);

    return project;
  }

  async listProjectsForWorkspace(
    workspaceId: string,
  ): Promise<BackendProjectRecord[]> {
    this.throwIfRequested();

    return [...this.records.values()]
      .filter(
        (project) =>
          project.workspaceId === workspaceId && project.status === "active",
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async getProjectForWorkspace(
    workspaceId: string,
    projectId: string,
  ): Promise<BackendProjectRecord | undefined> {
    this.throwIfRequested();
    const project = this.records.get(projectId);

    if (!project || project.workspaceId !== workspaceId || project.status !== "active") {
      return undefined;
    }

    return project;
  }

  async updateProjectTitleForWorkspace(input: {
    projectId: string;
    title: string;
    workspaceId: string;
  }): Promise<BackendProjectRecord | undefined> {
    this.throwIfRequested();
    const existing = await this.getProjectForWorkspace(
      input.workspaceId,
      input.projectId,
    );

    if (!existing) {
      return undefined;
    }

    const updated: BackendProjectRecord = {
      ...existing,
      title: input.title,
      updatedAt: this.nextTimestamp(),
    };

    this.records.set(updated.projectId, updated);

    return updated;
  }

  async getActiveProjectForWorkspaceUser(
    workspaceId: string,
    userId: string,
  ): Promise<BackendProjectRecord | undefined> {
    this.throwIfRequested();
    const projectId = this.activeProjects.get(`${workspaceId}:${userId}`);

    return projectId
      ? this.getProjectForWorkspace(workspaceId, projectId)
      : undefined;
  }

  async setActiveProjectForWorkspaceUser(input: {
    projectId: string;
    userId: string;
    workspaceId: string;
  }): Promise<BackendProjectRecord | undefined> {
    this.throwIfRequested();
    const project = await this.getProjectForWorkspace(
      input.workspaceId,
      input.projectId,
    );

    if (project) {
      this.activeProjects.set(
        `${input.workspaceId}:${input.userId}`,
        input.projectId,
      );
    }

    return project;
  }

  async clearActiveProjectForWorkspaceUser(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    this.throwIfRequested();
    this.activeProjects.delete(`${workspaceId}:${userId}`);
  }

  private nextTimestamp(): string {
    this.tick += 1;

    return new Date(Date.UTC(2026, 5, 20, 12, 0, this.tick)).toISOString();
  }

  private throwIfRequested(): void {
    if (this.shouldThrow) {
      throw new Error("raw database detail should be redacted");
    }
  }
}

const startProjectServer = async (options: {
  repository?: BackendProjectRepository;
  requesterKind?: "authenticated" | "unauthenticated" | "unverified_workspace";
}) => {
  const app = express();

  app.use(express.json());
  app.use(
    createProjectHistoryRouter({
      productionPersistenceWriter:
        createNotConfiguredProductionSupabasePersistenceWriter(),
      ...(options.repository ? { projectRepository: options.repository } : {}),
      routeAccessResolver: {
        resolve: async () =>
          options.requesterKind === "unauthenticated"
            ? createUnauthenticatedRequesterContext("missing_credentials")
            : options.requesterKind === "unverified_workspace"
              ? unverifiedWorkspaceRequester
              : requester,
      },
      runtimeConfig,
    }),
  );

  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("H6-D project persistence server did not expose a port.");
  }

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
    server,
    url: `http://127.0.0.1:${address.port}`,
  } satisfies {
    close: () => Promise<void>;
    server: Server;
    url: string;
  };
};

test.describe("Hosted private beta H6-D durable project persistence", () => {
  test("backend project CRUD derives ownership from verified requester context", async () => {
    const repository = new InMemoryProjectRepository();
    const server = await startProjectServer({ repository });

    try {
      const createResponse = await fetch(`${server.url}/project-library/projects`, {
        body: JSON.stringify({
          ownerId: "attacker",
          title: " First Private Beta Project ",
          workspaceId: "attacker-workspace",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      expect(createResponse.status).toBe(400);
      expectSensitiveProjectHeaders(createResponse);

      const validCreateResponse = await fetch(
        `${server.url}/project-library/projects`,
        {
          body: JSON.stringify({ title: "First Private Beta Project" }),
          headers: {
            "Content-Type": "application/json",
            "x-user-id": "spoofed-user",
            "x-workspace-id": otherWorkspaceId,
          },
          method: "POST",
        },
      );
      const created = await validCreateResponse.json();

      expect(validCreateResponse.status).toBe(201);
      expectSensitiveProjectHeaders(validCreateResponse);
      expect(created).toMatchObject({
        kind: "project_record",
        project: {
          status: "active",
          title: "First Private Beta Project",
        },
        status: "created",
      });
      expect(created.project.projectId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expectNoUnsafeFields(created);

      const persisted = repository.records.get(created.project.projectId);
      expect(persisted).toMatchObject({
        ownerId: requester.appUserId,
        workspaceId: requester.workspaceId,
      });

      const listResponse = await fetch(`${server.url}/project-library/projects`);
      const listBody = await listResponse.json();

      expect(listResponse.status).toBe(200);
      expectSensitiveProjectHeaders(listResponse);
      expect(listBody).toMatchObject({
        kind: "project_library",
        persistence: "durable",
        projects: [created.project],
        status: "authenticated",
      });
      expectNoUnsafeFields(listBody);

      const loadResponse = await fetch(
        `${server.url}/project-library/projects/${created.project.projectId}`,
      );
      const loaded = await loadResponse.json();

      expect(loadResponse.status).toBe(200);
      expectSensitiveProjectHeaders(loadResponse);
      expect(loaded).toMatchObject({
        kind: "project_record",
        project: created.project,
        status: "loaded",
      });

      const renameResponse = await fetch(
        `${server.url}/project-library/projects/${created.project.projectId}`,
        {
          body: JSON.stringify({ title: "Renamed Private Beta Project" }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        },
      );
      const renamed = await renameResponse.json();

      expect(renameResponse.status).toBe(200);
      expectSensitiveProjectHeaders(renameResponse);
      expect(renamed).toMatchObject({
        kind: "project_record",
        project: {
          projectId: created.project.projectId,
          title: "Renamed Private Beta Project",
        },
        status: "updated",
      });
      expect(renamed.project.updatedAt).not.toBe(created.project.updatedAt);
      expectNoUnsafeFields(renamed);
    } finally {
      await server.close();
    }
  });

  test("project route authorization rejects unauthenticated and unverified workspaces", async () => {
    const unauthenticated = await startProjectServer({
      repository: new InMemoryProjectRepository(),
      requesterKind: "unauthenticated",
    });
    const unverified = await startProjectServer({
      repository: new InMemoryProjectRepository(),
      requesterKind: "unverified_workspace",
    });

    try {
      const unauthenticatedResponse = await fetch(
        `${unauthenticated.url}/project-library/projects`,
      );
      const unverifiedResponse = await fetch(
        `${unverified.url}/project-library/projects`,
      );

      expect(unauthenticatedResponse.status).toBe(401);
      expectSensitiveProjectHeaders(unauthenticatedResponse);
      expect(await unauthenticatedResponse.json()).toMatchObject({
        kind: "project_library_sign_in_required",
        status: "unauthenticated",
      });

      expect(unverifiedResponse.status).toBe(403);
      expectSensitiveProjectHeaders(unverifiedResponse);
      expect(await unverifiedResponse.json()).toMatchObject({
        kind: "project_library_forbidden",
        status: "workspace_required",
      });
    } finally {
      await unauthenticated.close();
      await unverified.close();
    }
  });

  test("wrong workspace, missing, malformed, invalid title, and repository failures are safe", async () => {
    const repository = new InMemoryProjectRepository();
    const server = await startProjectServer({ repository });
    const otherWorkspaceProject = await repository.createProject({
      ownerId: "44444444-4444-4444-8444-444444444444",
      projectId: "55555555-5555-4555-8555-555555555555",
      title: "Other workspace project",
      workspaceId: otherWorkspaceId,
    });

    try {
      const wrongWorkspaceResponse = await fetch(
        `${server.url}/project-library/projects/${otherWorkspaceProject.projectId}`,
      );
      const missingResponse = await fetch(
        `${server.url}/project-library/projects/66666666-6666-4666-8666-666666666666`,
      );
      const malformedResponse = await fetch(
        `${server.url}/project-library/projects/not-a-project-id`,
      );
      const emptyTitleResponse = await fetch(
        `${server.url}/project-library/projects`,
        {
          body: JSON.stringify({ title: "   " }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const oversizedTitleResponse = await fetch(
        `${server.url}/project-library/projects`,
        {
          body: JSON.stringify({ title: "x".repeat(121) }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );

      expect(wrongWorkspaceResponse.status).toBe(404);
      expect(missingResponse.status).toBe(404);
      expect(await wrongWorkspaceResponse.json()).toMatchObject({
        kind: "project_not_found",
        status: "not_found",
      });
      expect(await missingResponse.json()).toMatchObject({
        kind: "project_not_found",
        status: "not_found",
      });
      expect(malformedResponse.status).toBe(400);
      expect(emptyTitleResponse.status).toBe(400);
      expect(oversizedTitleResponse.status).toBe(400);

      for (const response of [
        wrongWorkspaceResponse,
        missingResponse,
        malformedResponse,
        emptyTitleResponse,
        oversizedTitleResponse,
      ]) {
        expectSensitiveProjectHeaders(response);
      }

      repository.shouldThrow = true;
      const failureResponse = await fetch(`${server.url}/project-library/projects`);
      const failureBody = await failureResponse.json();

      expect(failureResponse.status).toBe(503);
      expectSensitiveProjectHeaders(failureResponse);
      expect(failureBody).toMatchObject({
        kind: "project_library_unavailable",
        status: "repository_unavailable",
      });
      expectNoUnsafeFields(failureBody);
    } finally {
      await server.close();
    }
  });

  test("durable contract survives separate HTTP requests and frontend source stays backend-boundary only", async () => {
    const repository = new InMemoryProjectRepository();
    const server = await startProjectServer({ repository });

    try {
      const createResponse = await fetch(`${server.url}/project-library/projects`, {
        body: JSON.stringify({ title: "Durable Loop Project" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const created = await createResponse.json();
      const listAfterCreate = await fetch(`${server.url}/project-library/projects`);
      const loadAfterList = await fetch(
        `${server.url}/project-library/projects/${created.project.projectId}`,
      );

      expect(createResponse.status).toBe(201);
      expect((await listAfterCreate.json()).projects).toEqual([created.project]);
      expect((await loadAfterList.json()).project).toEqual(created.project);
    } finally {
      await server.close();
    }

    const serviceSource = readProjectFile("src/services/projectLibraryService.ts");
    const storeSource = readProjectFile("src/store/projectLibraryStore.ts");
    const pageSource = readProjectFile("src/pages/ProjectsPage.tsx");
    const authenticatedFetchSource = readProjectFile(
      "src/services/auth/authenticatedFetch.ts",
    );
    const combinedFrontend = [
      serviceSource,
      storeSource,
      pageSource,
      authenticatedFetchSource,
    ].join("\n");

    expect(serviceSource).toContain("/project-library/projects");
    expect(serviceSource).not.toContain("ownerId:");
    expect(serviceSource).not.toContain("workspaceId:");
    expect(storeSource).not.toContain("localStorage");
    expect(storeSource).not.toContain("sessionStorage");
    expect(pageSource).not.toContain("Delete Project");
    expect(pageSource).not.toContain("Share Project");
    expect(pageSource).not.toContain("Download");
    expect(pageSource).not.toContain("Generate");
    expect(combinedFrontend).not.toContain("createClient(");
    expect(combinedFrontend).not.toContain("supabase.from(");
    expect(combinedFrontend).not.toContain(".storage.from(");
    expect(combinedFrontend).not.toContain("getPublicUrl(");
    expect(combinedFrontend).not.toContain("createSignedUrl(");
    expect(authenticatedFetchSource).toContain(
      "projectLibraryProjectRecordPathPattern",
    );
  });

  test("history placeholder and unrelated generation/provider/billing gates stay untouched", () => {
    const projectRoute = readProjectFile("backend/routes/projectHistory.ts");
    const generationRoute = readProjectFile("backend/routes/generation.ts");
    const providerSettingsRoute = readProjectFile(
      "backend/routes/providerSettings.ts",
    );
    const billingRoute = readProjectFile("backend/routes/billing.ts");
    const projectRepository = readProjectFile(
      "backend/repositories/supabaseProjectRepository.ts",
    );

    expect(projectRoute).toContain("/project-library/history");
    expect(projectRoute).toContain("Export history is available");
    expect(projectRepository).toContain("from(\"projects\")");
    expect(projectRepository).not.toContain("storage");
    expect(projectRepository).not.toContain("signed_url");
    expect(projectRepository).not.toContain("download_url");

    for (const forbidden of [
      "api.openai.com",
      "generativelanguage.googleapis.com",
      "stripe.checkout",
      "createCheckoutSession",
      "downloadUrl:",
      "signedUrl:",
      "publicUrl:",
    ]) {
      expect(projectRoute).not.toContain(forbidden);
    }

    expect(generationRoute).toContain("generationRouteExecutionMode");
    expect(providerSettingsRoute).toContain("providerValidationRuntimeEnabled");
    expect(billingRoute).toContain("No checkout");
  });
});
