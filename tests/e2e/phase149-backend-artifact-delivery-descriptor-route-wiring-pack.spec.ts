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
  jobId: "job-phase149",
  requestId: "request-phase149",
  timelineId: "timeline-phase149",
  ownerId: "owner-phase149",
  workspaceId: "workspace-phase149",
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
      throw new Error("claim should not be called in phase149");
    },
    markRendering: async () => {
      throw new Error("markRendering should not be called in phase149");
    },
    markFinalizing: async () => {
      throw new Error("markFinalizing should not be called in phase149");
    },
    markSuccess: async () => {
      throw new Error("markSuccess should not be called in phase149");
    },
    markError: async () => {
      throw new Error("markError should not be called in phase149");
    },
    transition: async () => {
      throw new Error("transition should not be called in phase149");
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

test.describe("phase149 backend artifact delivery descriptor route wiring pack", () => {
  test("descriptor route is wired but returns unavailable until workspace rls and storage are ready", async () => {
    await withTestServer({}, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/exports/${record.jobId}/artifacts/artifact-phase149/delivery`,
      );

      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload).toEqual({
        kind: "artifact_delivery_unavailable",
        reason: "authorization_required",
      });
    });
  });

  test("enforced descriptor route rejects unauthenticated and mismatched requesters safely", async () => {
    await withTestServer(
      {
        authorizationMode: "enforce",
      },
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/exports/${record.jobId}/artifacts/artifact-phase149/delivery`,
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
          `${baseUrl}/exports/${record.jobId}/artifacts/artifact-phase149/delivery`,
        );

        expect(response.status).toBe(403);

        const payload = await response.json();
        expect(payload.code).toBe("forbidden");
      },
    );
  });

  test("descriptor route avoids signed urls public urls frontend navigation and storage shortcuts", async () => {
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
          `${baseUrl}/exports/${record.jobId}/artifacts/artifact-phase149/delivery`,
        );

        expect(response.status).toBe(200);

        const payload = await response.json();
        expect(payload).toEqual({
          kind: "artifact_delivery_unavailable",
          reason: "workspace_or_rls_not_ready",
        });
      },
    );

    const routeSource = readSource("backend/routes/exports.ts");

    const frontendSource =
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/components/ArtifactDownloadAction.tsx") +
      "\n" +
      readIfExists("src/services/artifactDownloadUiState.ts") +
      "\n" +
      readIfExists("src/components/TimelineExportPanel.tsx") +
      "\n" +
      readIfExists("src/types/exportJob.ts") +
      "\n" +
      readIfExists("src/services/exportHandleStorage.ts");

    const artifactSource =
      readIfExists("backend/artifacts/productionArtifactDeliveryProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/backendMediatedArtifactDelivery.ts") +
      "\n" +
      readIfExists("backend/artifacts/artifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/notConfiguredArtifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/localDevArtifactAccessProvider.ts");

    expect(routeSource).toContain('"/exports/:jobId/artifacts/:artifactId/delivery"');
    expect(routeSource).toContain("resolveBackendMediatedArtifactDelivery");
    expect(routeSource).toContain("getExportRouteAuthorizationFailure");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("createSignedUrl");
    expect(routeSource).not.toContain("getPublicUrl");
    expect(routeSource).not.toContain("service_role");
    expect(routeSource).not.toContain("SERVICE_ROLE");

    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("getPublicUrl");
    expect(artifactSource).not.toContain("service_role");
    expect(artifactSource).not.toContain("SERVICE_ROLE");
    expect(artifactSource).not.toContain("production_ready_public_delivery");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");
    expect(frontendSource).not.toContain("document.createElement");
    expect(frontendSource).not.toContain(".click()");
  });
});
