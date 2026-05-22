import { test, expect } from "@playwright/test";
import express from "express";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createExportRouter } from "../../backend/routes/exports";
import type { ExportJobRegistry } from "../../backend/registry/exportJobRegistry";
import type { ProductionStorageProvider } from "../../backend/artifacts/productionStorageProvider";
import { createSupabaseProductionStorageProvider } from "../../backend/artifacts/supabaseProductionStorageProvider";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const record = {
  jobId: "job-phase172",
  requestId: "request-phase172",
  timelineId: "timeline-phase172",
  ownerId: "owner-phase172",
  workspaceId: "workspace-phase172",
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
      artifactId: "artifact-phase172",
      status: "available",
      filename: "phase172.mp4",
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
      throw new Error("claim should not be called in phase172");
    },
    markRendering: async () => {
      throw new Error("markRendering should not be called in phase172");
    },
    markFinalizing: async () => {
      throw new Error("markFinalizing should not be called in phase172");
    },
    markSuccess: async () => {
      throw new Error("markSuccess should not be called in phase172");
    },
    markError: async () => {
      throw new Error("markError should not be called in phase172");
    },
    transition: async () => {
      throw new Error("transition should not be called in phase172");
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
    productionStorageProvider?: ProductionStorageProvider;
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
      ...(options.productionStorageProvider
        ? { productionStorageProvider: options.productionStorageProvider }
        : {}),
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

test.describe("phase172 descriptor route production storage provider integration pack", () => {
  test("descriptor route accepts injected production storage provider but does not call it while workspace rls readiness is blocked", async () => {
    let verifyCalls = 0;

    const productionStorageProvider = createSupabaseProductionStorageProvider({
      env: {
        FREE_AI_MIXER_SUPABASE_URL: "https://example.supabase.co",
        FREE_AI_MIXER_SUPABASE_STORAGE_BACKEND_KEY: "backend-storage-key",
      },
      objectVerifier: {
        verifyObject: async ({ storageRef }) => {
          verifyCalls += 1;

          return {
            kind: "verified",
            provider: storageRef.provider,
            bucket: storageRef.bucket,
            objectKey: storageRef.objectKey,
            contentType: storageRef.contentType,
            sizeBytes: storageRef.sizeBytes,
          };
        },
      },
    });

    await withTestServer(
      {
        authorizationMode: "enforce",
        productionStorageProvider,
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
          `${baseUrl}/exports/${record.jobId}/artifacts/artifact-phase172/delivery`,
        );

        expect(response.status).toBe(200);

        const payload = await response.json();
        expect(payload).toEqual({
          kind: "artifact_delivery_unavailable",
          reason: "workspace_or_rls_not_ready",
        });
      },
    );

    expect(verifyCalls).toBe(0);
  });

  test("descriptor route does not call production storage provider before authorization succeeds", async () => {
    const throwingProvider: ProductionStorageProvider = {
      verifyObject: async () => {
        throw new Error("provider should not be called before authorization");
      },
    };

    await withTestServer(
      {
        authorizationMode: "enforce",
        productionStorageProvider: throwingProvider,
      },
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/exports/${record.jobId}/artifacts/artifact-phase172/delivery`,
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
  });

  test("descriptor route provider integration adds no signed public url frontend storage or navigation behavior", async () => {
    const routeSource = readSource("backend/routes/exports.ts");

    const backendArtifactSource =
      readSource("backend/artifacts/supabaseProductionStorageProvider.ts") +
      "\n" +
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

    expect(routeSource).toContain("productionStorageProvider?: ProductionStorageProvider");
    expect(routeSource).toContain("provider: options?.productionStorageProvider");
    expect(routeSource).toContain("resolveProductionStorageReadiness");
    expect(routeSource).toContain("workspaceMembershipOrRlsReady: false");

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

