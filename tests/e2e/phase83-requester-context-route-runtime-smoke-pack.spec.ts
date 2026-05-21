import { test, expect } from "@playwright/test";
import express from "express";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createExportRouter, exportErrorHandler } from "../../backend/routes/exports";
import type { ExportJobRegistry } from "../../backend/registry/exportJobRegistry";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const createFakeRegistry = (): ExportJobRegistry => ({
  create: async (input) => ({
    jobId: input.jobId,
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
    throw new Error("claim should not be called in phase83 route smoke");
  },
  markRendering: async () => {
    throw new Error("markRendering should not be called in phase83 route smoke");
  },
  markFinalizing: async () => {
    throw new Error("markFinalizing should not be called in phase83 route smoke");
  },
  markSuccess: async () => {
    throw new Error("markSuccess should not be called in phase83 route smoke");
  },
  markError: async () => {
    throw new Error("markError should not be called in phase83 route smoke");
  },
  transition: async () => {
    throw new Error("generic transition should remain unused");
  },
});

const withTestServer = async (
  registry: ExportJobRegistry,
  requesterContextResolver: { resolve: (input?: unknown) => unknown },
  run: (baseUrl: string) => Promise<void>,
): Promise<void> => {
  const app = express();

  app.use(express.json());
  app.use(
    "/exports",
    createExportRouter(registry, {
      requesterContextResolver,
    }),
  );
  app.use(exportErrorHandler);

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

test.describe("phase83 requester context route runtime smoke pack", () => {
  test("export routes invoke injected requester resolver without enforcing auth", async () => {
    const resolvedHeaders: unknown[] = [];

    const requesterContextResolver = {
      resolve: (input?: unknown) => {
        resolvedHeaders.push(input);

        return {
          kind: "unauthenticated",
          reason: "auth_not_configured",
        };
      },
    };

    await withTestServer(createFakeRegistry(), requesterContextResolver, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/exports`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer fake-token-must-not-authenticate",
          "x-user-id": "fake-user-must-not-authenticate",
        },
        body: JSON.stringify({
          timelineId: "timeline-phase83",
          requestId: "request-phase83",
          ownerId: "owner-phase83",
          workspaceId: "workspace-phase83",
        }),
      });

      expect(response.status).toBe(202);

      const payload = await response.json();

      expect(payload.status).toBe("accepted_job");
      expect(payload.handle.jobId).toBeTruthy();
      expect(payload.handle.requestId).toBe("request-phase83");
    });

    expect(resolvedHeaders.length).toBeGreaterThan(0);
  });

  test("source keeps requester route resolver non-enforcing and separate from fake auth", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const requesterSource = readSource("backend/requester/exportRequesterContext.ts");
    const authResolverSource = readSource("backend/auth/requesterContextResolver.ts");

    expect(routeSource).toContain("requesterContextResolver?: ExportRequesterContextResolver");
    expect(routeSource).toContain("options?.requesterContextResolver ?? resolveExportRequesterContext");
    expect(routeSource).toContain("requesterContextResolver");

    expect(requesterSource).toContain("resolveExportRequesterContext");
    expect(authResolverSource).toContain("auth_not_configured");

    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("service_role");
    expect(routeSource).not.toContain("SERVICE_ROLE");

    // Phase 83 is runtime smoke only, not route authorization enforcement.
    expect(routeSource).not.toContain("isAuthenticatedRequesterContext");
    expect(routeSource).not.toContain("throw new ExportApiError(401");
    expect(routeSource).not.toContain("throw new ExportApiError(403");
  });

  test("frontend remains backend mediated and public artifact delivery remains deferred", async () => {
    const frontendSource =
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/types/exportJob.ts") +
      "\n" +
      readIfExists("src/services/exportHandleStorage.ts");

    const docsSource =
      readIfExists("docs/known-issues.md") + "\n" + readIfExists("docs/phases.md");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");

    expect(docsSource).toContain("auth");
    expect(docsSource).toContain("RLS");
    expect(docsSource).toContain("ownership");
  });
});
