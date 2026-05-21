import { test, expect } from "@playwright/test";
import express from "express";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createExportRouter } from "../../backend/routes/exports";
import { createTrustedAuthNotConfiguredMiddleware } from "../../backend/auth/trustedAuthMiddleware";
import type { ExportJobRegistry } from "../../backend/registry/exportJobRegistry";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const createFakeRegistry = (): ExportJobRegistry =>
  ({
    create: async (input: any) => ({
      jobId: "job-phase94",
      requestId: input.requestId,
      ownerId: input.ownerId,
      workspaceId: input.workspaceId,
      status: "submitted",
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      artifacts: [],
    }),
    getById: async () => undefined,
    getByIdForOwner: async () => undefined,
    getByRequestId: async () => undefined,
    getByStatus: async () => [],
    claim: async () => {
      throw new Error("claim should not be called in phase94 route smoke");
    },
    markRendering: async () => {
      throw new Error("markRendering should not be called in phase94 route smoke");
    },
    markFinalizing: async () => {
      throw new Error("markFinalizing should not be called in phase94 route smoke");
    },
    markSuccess: async () => {
      throw new Error("markSuccess should not be called in phase94 route smoke");
    },
    markError: async () => {
      throw new Error("markError should not be called in phase94 route smoke");
    },
    transition: async () => {
      throw new Error("generic transition should remain unused");
    },
  }) as unknown as ExportJobRegistry;

const withTestServer = async (
  registry: ExportJobRegistry,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> => {
  const app = express();

  app.use(express.json());
  app.use(createTrustedAuthNotConfiguredMiddleware());
  app.use(createExportRouter(registry));

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

test.describe("phase94 export routes trusted request context non enforcing consumption pack", () => {
  test("export route can run with trusted auth middleware present without enforcing authorization", async () => {
    await withTestServer(createFakeRegistry(), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/exports`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer fake-token-must-not-authenticate",
          "x-user-id": "fake-user-must-not-authenticate",
          "x-workspace-id": "fake-workspace-must-not-authenticate",
        },
        body: JSON.stringify({
          timelineId: "timeline-phase94",
          requestId: "request-phase94",
          requestedAt: new Date().toISOString(),
          renderSettings: {
            format: "mp4",
            resolution: "720p",
            fps: 30,
            quality: "standard",
          },
        }),
      });

      expect(response.status).toBe(202);

      const payload = await response.json();

      expect(payload.kind).toBe("accepted_job");
      expect(payload.handle.jobId).toBeTruthy();
      expect(payload.handle.requestId).toBe("request-phase94");
    });
  });

  test("routes read trusted request context but do not authorize or trust headers yet", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const appSource = readSource("backend/app.ts");
    const middlewareSource = readSource("backend/auth/trustedAuthMiddleware.ts");

    expect(appSource).toContain("createTrustedAuthNotConfiguredMiddleware");
    expect(routeSource).toContain("getRequesterContextFromRequest");
    expect(middlewareSource).toContain("auth_not_configured");

    expect(routeSource).not.toContain("adaptAuthenticatedRequesterToExportRequesterContext");
    expect(routeSource).not.toContain("decideExportOwnerScopeAccess");
    expect(routeSource).not.toContain("mapExportAuthorizationDecisionToRouteGuard");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("frontend and artifact delivery remain blocked after non-enforcing route consumption", async () => {
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
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");

    expect(artifactSource).not.toContain("production_ready_local_dev_stream");
    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("getPublicUrl");
  });
});
