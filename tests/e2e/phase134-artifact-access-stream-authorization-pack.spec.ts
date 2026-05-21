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
  jobId: "job-phase134",
  requestId: "request-phase134",
  timelineId: "timeline-phase134",
  ownerId: "owner-phase134",
  workspaceId: "workspace-phase134",
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
      throw new Error("claim should not be called in phase134");
    },
    markRendering: async () => {
      throw new Error("markRendering should not be called in phase134");
    },
    markFinalizing: async () => {
      throw new Error("markFinalizing should not be called in phase134");
    },
    markSuccess: async () => {
      throw new Error("markSuccess should not be called in phase134");
    },
    markError: async () => {
      throw new Error("markError should not be called in phase134");
    },
    transition: async () => {
      throw new Error("transition should not be called in phase134");
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

test.describe("phase134 artifact access stream authorization pack", () => {
  test("artifact access authorization remains disabled by default", async () => {
    await withTestServer({}, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/exports/${record.jobId}/artifacts/artifact-phase134/access`,
        {
          headers: {
            authorization: "Bearer fake-token-must-not-authenticate",
            "x-user-id": "fake-user-must-not-authenticate",
            "x-workspace-id": "fake-workspace-must-not-authenticate",
          },
        },
      );

      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.kind).toBe("artifact_access_unavailable");
    });
  });

  test("explicit enforcement protects artifact access route with 401 403 and matching allow-through", async () => {
    await withTestServer(
      {
        authorizationMode: "enforce",
      },
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/exports/${record.jobId}/artifacts/artifact-phase134/access`,
          {
            headers: {
              "x-user-id": record.ownerId,
              "x-workspace-id": record.workspaceId,
            },
          },
        );

        expect(response.status).toBe(401);

        const payload = await response.json();
        expect(payload.code).toBe("unauthorized");
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
        const response = await fetch(
          `${baseUrl}/exports/${record.jobId}/artifacts/artifact-phase134/access`,
        );

        expect(response.status).toBe(403);

        const payload = await response.json();
        expect(payload.code).toBe("forbidden");
      },
    );

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
        const response = await fetch(
          `${baseUrl}/exports/${record.jobId}/artifacts/artifact-phase134/access`,
        );

        expect(response.status).not.toBe(401);
        expect(response.status).not.toBe(403);
      },
    );
  });

  test("artifact stream remains blocked without enabling public delivery when stream provider is not configured", async () => {
    await withTestServer(
      {
        authorizationMode: "enforce",
      },
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/exports/${record.jobId}/artifacts/artifact-phase134/stream`,
          {
            headers: {
              "x-user-id": record.ownerId,
              "x-workspace-id": record.workspaceId,
            },
          },
        );

        expect(response.status).toBe(501);
      },
    );

    const routeSource = readSource("backend/routes/exports.ts");

    expect(routeSource).toContain("Phase 134 authorization guard for artifact access/stream routes");
    expect(routeSource).toContain("getExportRouteAuthorizationFailure");
    expect(routeSource).toContain("getRequesterContextFromRequest");

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

