import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { createApp } from "../../backend/app";

const appSourcePath = path.join(process.cwd(), "backend", "app.ts");
const routeSourcePath = path.join(process.cwd(), "backend", "routes", "exports.ts");
const requesterRoot = path.join(process.cwd(), "backend", "requester");
const authRoot = path.join(process.cwd(), "backend", "auth");
const frontendRoot = path.join(process.cwd(), "src");

const createValidRequest = (requestId: string) => ({
  requestId,
  timelineId: "timeline-phase35",
  renderSettings: {
    format: "mp4",
    resolution: "1080p",
    fps: 30,
    quality: "standard",
  },
  requestedAt: new Date().toISOString(),
});

const getAllFileContents = async (rootPath: string): Promise<string[]> => {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(rootPath, entry.name);
      if (entry.isDirectory()) {
        return getAllFileContents(fullPath);
      }

      if (!entry.isFile()) {
        return [] as string[];
      }

      return [await fs.readFile(fullPath, "utf8")];
    }),
  );

  return nested.flat();
};

type HarnessRecord = {
  jobId: string;
  requestId: string;
  ownerId: string;
  workspaceId: string;
  status: "submitted";
};

class FakeRouteRepositoryHarness {
  private readonly byScopeAndRequestId = new Map<string, HarnessRecord>();

  private readonly byJobId = new Map<string, HarnessRecord>();

  createOrReuse(params: {
    jobId: string;
    requestId: string;
    ownerId: string;
    workspaceId: string;
  }): HarnessRecord {
    const scopeKey = `${params.workspaceId}::${params.ownerId}::${params.requestId}`;
    const existing = this.byScopeAndRequestId.get(scopeKey);
    if (existing) {
      return existing;
    }

    const created: HarnessRecord = {
      jobId: params.jobId,
      requestId: params.requestId,
      ownerId: params.ownerId,
      workspaceId: params.workspaceId,
      status: "submitted",
    };
    this.byScopeAndRequestId.set(scopeKey, created);
    this.byJobId.set(created.jobId, created);
    return created;
  }

  getForOwner(jobId: string, scope: { ownerId: string; workspaceId: string }): HarnessRecord | undefined {
    const record = this.byJobId.get(jobId);
    if (!record) {
      return undefined;
    }

    if (
      record.ownerId !== scope.ownerId ||
      record.workspaceId !== scope.workspaceId
    ) {
      return undefined;
    }

    return record;
  }
}

let server: Server;
let baseUrl: string;

test.beforeAll(async () => {
  const app = createApp();
  server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

test.describe("phase35 route repository harness", () => {
  test("production routes and app startup stay free of DB repository wiring and migration execution", async () => {
    const [appSource, routeSource] = await Promise.all([
      fs.readFile(appSourcePath, "utf8"),
      fs.readFile(routeSourcePath, "utf8"),
    ]);

    expect(routeSource).not.toContain("supabaseExportJobsRepository");
    expect(routeSource).not.toContain("supabaseAccountWorkspaceRepository");
    expect(routeSource).not.toContain("repositoryComposition");
    expect(routeSource).not.toContain("createRepositories");
    expect(routeSource).not.toContain("serviceRoleKey");
    expect(routeSource).not.toContain("migrationWorkflow");
    expect(routeSource).not.toContain("migrate(");

    expect(appSource).not.toContain("supabaseExportJobsRepository");
    expect(appSource).not.toContain("supabaseAccountWorkspaceRepository");
    expect(appSource).not.toContain("createRepositories");
    expect(appSource).not.toContain("serviceRoleKey");
    expect(appSource).not.toContain("migrationWorkflow");
    expect(appSource).not.toContain("migrate(");
  });

  test("POST /exports remains truthful non-executing and compatible with a test-only repository harness", async () => {
    const requestId = "request-phase35-post";
    const harness = new FakeRouteRepositoryHarness();

    const firstResponse = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createValidRequest(requestId)),
    });
    expect(firstResponse.status).toBe(202);
    const firstBody = (await firstResponse.json()) as {
      kind: string;
      handle: { jobId: string; status: string };
      result?: unknown;
      artifacts?: unknown;
      downloadUrl?: unknown;
      progress?: unknown;
    };

    const firstHarnessRecord = harness.createOrReuse({
      jobId: firstBody.handle.jobId,
      requestId,
      ownerId: "local-dev-owner",
      workspaceId: "local-dev-workspace",
    });

    expect(firstBody.kind).toBe("accepted_job");
    expect(firstBody.handle.status).toBe("submitted");
    expect(firstBody.result).toBeUndefined();
    expect(firstBody.artifacts).toBeUndefined();
    expect(firstBody.downloadUrl).toBeUndefined();
    expect(firstBody.progress).toBeUndefined();
    expect(firstHarnessRecord.status).toBe("submitted");

    const secondResponse = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createValidRequest(requestId)),
    });
    expect(secondResponse.status).toBe(202);
    const secondBody = (await secondResponse.json()) as {
      kind: string;
      handle: { jobId: string; status: string };
    };

    const secondHarnessRecord = harness.createOrReuse({
      jobId: secondBody.handle.jobId,
      requestId,
      ownerId: "local-dev-owner",
      workspaceId: "local-dev-workspace",
    });

    expect(secondBody.kind).toBe("accepted_job");
    expect(secondBody.handle.status).toBe("submitted");
    expect(secondBody.handle.jobId).toBe(firstBody.handle.jobId);
    expect(secondHarnessRecord.jobId).toBe(firstHarnessRecord.jobId);
  });

  test("GET /exports/:jobId remains compatible with current owner scoped semantics", async () => {
    const createResponse = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createValidRequest("request-phase35-get")),
    });
    const created = (await createResponse.json()) as {
      handle: { jobId: string };
    };

    const harness = new FakeRouteRepositoryHarness();
    const harnessRecord = harness.createOrReuse({
      jobId: created.handle.jobId,
      requestId: "request-phase35-get",
      ownerId: "local-dev-owner",
      workspaceId: "local-dev-workspace",
    });

    const knownResponse = await fetch(`${baseUrl}/exports/${created.handle.jobId}`);
    expect(knownResponse.status).toBe(200);
    const knownBody = (await knownResponse.json()) as Record<string, unknown>;
    expect(knownBody.kind).toBe("pending");
    expect(knownBody).toHaveProperty("handle");
    expect(knownBody).not.toHaveProperty("result");
    expect(knownBody).not.toHaveProperty("artifacts");
    expect(knownBody).not.toHaveProperty("downloadUrl");
    expect(knownBody).not.toHaveProperty("progress");

    expect(
      harness.getForOwner(created.handle.jobId, {
        ownerId: "local-dev-owner",
        workspaceId: "local-dev-workspace",
      })?.jobId,
    ).toBe(harnessRecord.jobId);
    expect(
      harness.getForOwner(created.handle.jobId, {
        ownerId: "other-owner",
        workspaceId: "other-workspace",
      }),
    ).toBeUndefined();

    const unknownResponse = await fetch(`${baseUrl}/exports/unknown-phase35-job`);
    expect(unknownResponse.status).toBe(404);
    const unknownBody = (await unknownResponse.json()) as Record<string, unknown>;
    expect(unknownBody.code).toBe("export_job_not_found");
  });

  test("production sources keep auth requester frontend storage and download concerns out of the harness path", async () => {
    const [requesterSources, authSources, frontendSources, routeSource] =
      await Promise.all([
        getAllFileContents(requesterRoot),
        getAllFileContents(authRoot),
        getAllFileContents(frontendRoot),
        fs.readFile(routeSourcePath, "utf8"),
      ]);

    expect(routeSource).toContain("requesterContextResolver");
    expect(routeSource).toContain(
      "options?.requesterContextResolver ?? resolveExportRequesterContext",
    );
    expect(routeSource).not.toContain("supabaseClientFactory");
    expect(routeSource).not.toContain("repositoryComposition");
    expect(routeSource).not.toContain("signed_url");
    expect(routeSource).not.toContain("downloadUrl:");
    expect(routeSource).not.toContain("serviceRoleKey");

    expect(requesterSources.join("\n")).not.toContain("supabaseExportJobsRepository");
    expect(requesterSources.join("\n")).not.toContain("supabaseAccountWorkspaceRepository");
    expect(authSources.join("\n")).not.toContain("supabaseExportJobsRepository");
    expect(authSources.join("\n")).not.toContain("supabaseAccountWorkspaceRepository");
    expect(authSources.join("\n")).not.toContain("@supabase/supabase-js");
    expect(frontendSources.join("\n")).not.toContain("supabaseExportJobsRepository");
    expect(frontendSources.join("\n")).not.toContain("supabaseAccountWorkspaceRepository");
    expect(frontendSources.join("\n")).not.toContain("repositoryComposition");
    expect(frontendSources.join("\n")).not.toContain("@supabase/supabase-js");
  });
});
