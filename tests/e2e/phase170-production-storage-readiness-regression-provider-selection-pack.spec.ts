import { test, expect } from "@playwright/test";
import express from "express";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createExportRouter } from "../../backend/routes/exports";
import type { ExportJobRegistry } from "../../backend/registry/exportJobRegistry";
import {
  resolveProductionStorageReadiness,
} from "../../backend/artifacts/productionStorageProviderIntegration";
import type {
  ProductionStorageProvider,
} from "../../backend/artifacts/productionStorageProvider";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const baseRecord = {
  jobId: "job-phase170",
  requestId: "request-phase170",
  timelineId: "timeline-phase170",
  ownerId: "owner-phase170",
  workspaceId: "workspace-phase170",
  status: "submitted",
  renderSettings: {
    format: "mp4",
    resolution: "720p",
    fps: 30,
    quality: "draft",
  },
  submittedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  artifacts: [
    {
      artifactId: "artifact-phase170",
      status: "available",
      filename: "phase170.mp4",
      mimeType: "video/mp4",
      sizeBytes: 1024,
      storageRef: {
        provider: "supabase_storage",
        bucket: "exports",
        objectKey: "workspace/job/artifact.mp4",
        contentType: "video/mp4",
        sizeBytes: 1024,
      },
    },
  ],
};

const createFakeRegistry = (
  recordOverride: Record<string, unknown> = {},
): ExportJobRegistry => {
  const record = {
    ...baseRecord,
    ...recordOverride,
  };

  return ({
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
      throw new Error("claim should not be called in phase170");
    },
    markRendering: async () => {
      throw new Error("markRendering should not be called in phase170");
    },
    markFinalizing: async () => {
      throw new Error("markFinalizing should not be called in phase170");
    },
    markSuccess: async () => {
      throw new Error("markSuccess should not be called in phase170");
    },
    markError: async () => {
      throw new Error("markError should not be called in phase170");
    },
    transition: async () => {
      throw new Error("transition should not be called in phase170");
    },
  }) as unknown as ExportJobRegistry;
};

const requesterContextResolver = () => ({
  ownerId: baseRecord.ownerId,
  workspaceId: baseRecord.workspaceId,
  authMode: "local_dev_fallback" as const,
});

const withTestServer = async (
  options: {
    authorizationMode?: "disabled" | "enforce";
    trustedRequesterContext?: unknown;
    recordOverride?: Record<string, unknown>;
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
    createExportRouter(createFakeRegistry(options.recordOverride), {
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

const validStorageRef = {
  provider: "supabase_storage" as const,
  bucket: "exports",
  objectKey: "workspace/job/artifact.mp4",
  contentType: "video/mp4",
  sizeBytes: 1024,
};

test.describe("phase170 production storage readiness regression provider selection pack", () => {
  test("provider selection audit chooses Supabase Storage while keeping implementation deferred", async () => {
    const auditSource = readSource(
      "docs/security/phase170-production-storage-readiness-regression-provider-selection.md",
    );

    expect(auditSource).toContain("Status: regression + provider selection audit only");
    expect(auditSource).toContain("Missing storageRef cannot produce ready delivery");
    expect(auditSource).toContain("Recommended first provider");
    expect(auditSource).toContain("Supabase Storage");
    expect(auditSource).toContain("Phase 171 - Supabase Production Storage Provider Boundary + Verification Pack");
    expect(auditSource).toContain("not generate signed URLs yet");
    expect(auditSource).toContain("not add frontend Supabase/storage access");
  });

  test("production storage readiness regressions fail closed for missing invalid not-configured and object missing states", async () => {
    await expect(
      resolveProductionStorageReadiness({
        artifactId: "artifact-phase170",
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "missing_storage_ref",
      providerConfigured: false,
      providerCanResolve: false,
    });

    await expect(
      resolveProductionStorageReadiness({
        artifactId: "artifact-phase170",
        storageRef: {
          provider: "supabase_storage",
          bucket: "exports",
          objectKey: "../artifact.mp4",
        },
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "invalid_storage_ref",
      providerConfigured: false,
      providerCanResolve: false,
    });

    await expect(
      resolveProductionStorageReadiness({
        artifactId: "artifact-phase170",
        storageRef: validStorageRef,
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "provider_not_configured",
      providerConfigured: false,
      providerCanResolve: false,
    });

    const objectMissingProvider: ProductionStorageProvider = {
      verifyObject: async () => ({
        kind: "unavailable",
        reason: "object_not_found",
      }),
    };

    await expect(
      resolveProductionStorageReadiness({
        artifactId: "artifact-phase170",
        storageRef: validStorageRef,
        provider: objectMissingProvider,
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "object_not_found",
      providerConfigured: false,
      providerCanResolve: false,
    });
  });

  test("descriptor route storage readiness remains blocked before delivery shortcuts can exist", async () => {
    await withTestServer(
      {
        authorizationMode: "enforce",
      },
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/exports/${baseRecord.jobId}/artifacts/artifact-phase170/delivery`,
          {
            headers: {
              "x-user-id": baseRecord.ownerId,
              "x-workspace-id": baseRecord.workspaceId,
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
          userId: "other-owner",
          workspaceId: baseRecord.workspaceId,
          authProvider: "jwt",
          authSubject: "other-owner",
        },
      },
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/exports/${baseRecord.jobId}/artifacts/artifact-phase170/delivery`,
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
          userId: baseRecord.ownerId,
          workspaceId: baseRecord.workspaceId,
          authProvider: "jwt",
          authSubject: baseRecord.ownerId,
        },
      },
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/exports/${baseRecord.jobId}/artifacts/artifact-phase170/delivery`,
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

    const backendArtifactSource =
      readSource("backend/artifacts/productionStorageProviderIntegration.ts") +
      "\n" +
      readSource("backend/artifacts/productionStorageProvider.ts") +
      "\n" +
      readSource("backend/artifacts/artifactDeliveryReadyPreconditions.ts") +
      "\n" +
      readSource("backend/artifacts/backendMediatedArtifactDelivery.ts") +
      "\n" +
      readIfExists("backend/artifacts/productionArtifactDeliveryProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/artifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/notConfiguredArtifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/localDevArtifactAccessProvider.ts");

    const frontendSource =
      readSource("src/services/artifactDownloadNavigationStrategy.ts") +
      "\n" +
      readSource("src/components/TimelineExportPanel.tsx") +
      "\n" +
      readSource("src/components/ArtifactDeliveryDescriptorAction.tsx") +
      "\n" +
      readSource("src/components/ArtifactDownloadAction.tsx") +
      "\n" +
      readSource("src/store/artifactDeliveryDescriptorStore.ts") +
      "\n" +
      readSource("src/services/artifactDeliveryDescriptorService.ts") +
      "\n" +
      readSource("src/services/artifactDownloadUiState.ts");

    expect(routeSource).toContain("resolveProductionStorageReadiness");
    expect(routeSource).toContain("productionStorageReadiness.providerConfigured");
    expect(routeSource).toContain("productionStorageReadiness.providerCanResolve");
    expect(routeSource).toContain("workspaceMembershipOrRlsReady: false");

    expect(readIfExists("backend/artifacts/supabaseProductionStorageProvider.ts")).toContain("createSupabaseProductionStorageProvider");
    expect(readIfExists("backend/artifacts/s3ProductionStorageProvider.ts")).toBe("");
    expect(readIfExists("backend/artifacts/r2ProductionStorageProvider.ts")).toBe("");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("createSignedUrl");
    expect(routeSource).not.toContain("getPublicUrl");
    expect(routeSource).not.toContain("service_role");
    expect(routeSource).not.toContain("SERVICE_ROLE");

    expect(backendArtifactSource).not.toContain("createSignedUrl");
    expect(backendArtifactSource).not.toContain("getPublicUrl");
    expect(backendArtifactSource).not.toContain("service_role");
    expect(backendArtifactSource).not.toContain("SERVICE_ROLE");
    expect(backendArtifactSource).not.toContain("production_ready_public_delivery");

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

