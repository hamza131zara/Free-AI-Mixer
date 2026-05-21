import { test, expect } from "@playwright/test";
import express from "express";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createExportRouter } from "../../backend/routes/exports";
import type { ExportJobRegistry } from "../../backend/registry/exportJobRegistry";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const record = {
  jobId: "job-phase135",
  requestId: "request-phase135",
  timelineId: "timeline-phase135",
  ownerId: "owner-phase135",
  workspaceId: "workspace-phase135",
  status: "submitted",
  renderSettings: {
    format: "mp4",
    resolution: "720p",
    fps: 30,
    quality: "draft",
  },
  submittedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  artifacts: [],
};

const createFakeRegistry = (): ExportJobRegistry =>
  ({
    create: async (input: any) => ({
      ...record,
      requestId: input.requestId,
      timelineId: input.timelineId,
      ownerId: input.ownerId,
      workspaceId: input.workspaceId,
      renderSettings: input.renderSettings,
    }),
    getById: async () => record,
    getByIdForOwner: async () => record,
    getByRequestId: async () => undefined,
    getByStatus: async () => [record],
    claim: async () => {
      throw new Error("claim should not be called in phase135");
    },
    markRendering: async () => {
      throw new Error("markRendering should not be called in phase135");
    },
    markFinalizing: async () => {
      throw new Error("markFinalizing should not be called in phase135");
    },
    markSuccess: async () => {
      throw new Error("markSuccess should not be called in phase135");
    },
    markError: async () => {
      throw new Error("markError should not be called in phase135");
    },
    transition: async () => {
      throw new Error("transition should not be called in phase135");
    },
  }) as unknown as ExportJobRegistry;

const requesterContextResolver = () => ({
  ownerId: record.ownerId,
  workspaceId: record.workspaceId,
  authMode: "local_dev_fallback" as const,
});

const withTestServer = async (
  options: {
    authorizationMode?: "disabled" | "enforce";
    trustedRequesterContext?: unknown;
  },
  run: (baseUrl: string) => Promise<void>,
): Promise<void> => {
  const app = express();
  app.use(express.json());

  if (options.trustedRequesterContext) {
    app.use((request, _response, next) => {
      (request as any).backendRequesterContext = options.trustedRequesterContext;
      next();
    });
  }

  app.use(
    createExportRouter(createFakeRegistry(), {
      requesterContextResolver,
      ...(options.authorizationMode ? { authorizationMode: options.authorizationMode } : {}),
    }),
  );

  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Failed to start test server");
  }

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
};

test.describe("phase135 route authorization regression pack", () => {
  test("default local-dev behavior remains unchanged and non-enforcing", async () => {
    await withTestServer({}, async (baseUrl) => {
      const statusResponse = await fetch(`${baseUrl}/exports/${record.jobId}`, {
        headers: {
          "x-user-id": "fake-user-must-not-authenticate",
          "x-workspace-id": "fake-workspace-must-not-authenticate",
        },
      });

      expect(statusResponse.status).toBe(200);

      const statusPayload = await statusResponse.json();
      expect(statusPayload.kind).toBe("pending");
      expect(statusPayload.handle.jobId).toBe(record.jobId);

      const accessResponse = await fetch(
        `${baseUrl}/exports/${record.jobId}/artifacts/artifact-phase135/access`,
        {
          headers: {
            "x-user-id": "fake-user-must-not-authenticate",
            "x-workspace-id": "fake-workspace-must-not-authenticate",
          },
        },
      );

      expect(accessResponse.status).toBe(200);

      const accessPayload = await accessResponse.json();
      expect(accessPayload.kind).toBe("artifact_access_unavailable");
    });
  });

  test("enforced status and artifact access reject trusted-header shortcuts and mismatched authenticated context", async () => {
    await withTestServer(
      {
        authorizationMode: "enforce",
      },
      async (baseUrl) => {
        const statusResponse = await fetch(`${baseUrl}/exports/${record.jobId}`, {
          headers: {
            "x-user-id": record.ownerId,
            "x-workspace-id": record.workspaceId,
          },
        });

        expect(statusResponse.status).toBe(401);

        const statusPayload = await statusResponse.json();
        expect(statusPayload.code).toBe("unauthorized");

        const accessResponse = await fetch(
          `${baseUrl}/exports/${record.jobId}/artifacts/artifact-phase135/access`,
          {
            headers: {
              "x-user-id": record.ownerId,
              "x-workspace-id": record.workspaceId,
            },
          },
        );

        expect(accessResponse.status).toBe(401);

        const accessPayload = await accessResponse.json();
        expect(accessPayload.code).toBe("unauthorized");
      },
    );

    await withTestServer(
      {
        authorizationMode: "enforce",
        trustedRequesterContext: {
          kind: "authenticated",
          userId: "different-owner",
          workspaceId: record.workspaceId,
          authProvider: "jwt",
          authSubject: "different-owner",
        },
      },
      async (baseUrl) => {
        const statusResponse = await fetch(`${baseUrl}/exports/${record.jobId}`);
        expect(statusResponse.status).toBe(403);

        const accessResponse = await fetch(
          `${baseUrl}/exports/${record.jobId}/artifacts/artifact-phase135/access`,
        );

        expect(accessResponse.status).toBe(403);
      },
    );
  });

  test("matching authenticated context allows guarded routes while stream remains safely blocked when unconfigured", async () => {
    await withTestServer(
      {
        authorizationMode: "enforce",
        trustedRequesterContext: {
          kind: "authenticated",
          userId: record.ownerId,
          workspaceId: record.workspaceId,
          authProvider: "jwt",
          authSubject: record.ownerId,
        },
      },
      async (baseUrl) => {
        const statusResponse = await fetch(`${baseUrl}/exports/${record.jobId}`);
        expect(statusResponse.status).toBe(200);

        const accessResponse = await fetch(
          `${baseUrl}/exports/${record.jobId}/artifacts/artifact-phase135/access`,
        );

        expect(accessResponse.status).not.toBe(401);
        expect(accessResponse.status).not.toBe(403);

        const streamResponse = await fetch(
          `${baseUrl}/exports/${record.jobId}/artifacts/artifact-phase135/stream`,
        );

        expect(streamResponse.status).toBe(501);
      },
    );

    const routeSource = readSource("backend/routes/exports.ts");

    expect(routeSource).toContain("authorizationMode?: ExportRouteAuthorizationMode");
    expect(routeSource).toContain("getExportRouteAuthorizationFailure");
    expect(routeSource).toContain("getRequesterContextFromRequest");
    expect(routeSource).toContain("statusCode: exportAuthorizationUnauthorizedStatus");
    expect(routeSource).toContain("statusCode: exportAuthorizationForbiddenStatus");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("createSignedUrl");
    expect(routeSource).not.toContain("getPublicUrl");

    const frontendSource =
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/types/exportJob.ts") +
      "\n" +
      readIfExists("src/services/exportHandleStorage.ts");

    const artifactSource =
      readIfExists("backend/artifacts/artifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/localDevArtifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/notConfiguredArtifactAccessProvider.ts");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");

    expect(artifactSource).not.toContain("production_ready_local_dev_stream");
    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("getPublicUrl");
  });
});
