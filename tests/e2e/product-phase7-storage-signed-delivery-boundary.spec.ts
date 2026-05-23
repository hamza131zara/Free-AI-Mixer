import { expect, test } from "@playwright/test";
import express from "express";
import type { Server } from "node:http";
import { createServer } from "node:http";
import {
  DEFAULT_SIGNED_URL_EXPIRES_IN_SECONDS,
  MAX_SIGNED_URL_EXPIRES_IN_SECONDS,
  createSignedUrlDeliveryNotConfiguredProvider,
  resolveSignedUrlExpiresAt,
} from "../../backend/artifacts/signedUrlDeliveryProvider";
import type { ExportJobRegistry } from "../../backend/registry/exportJobRegistry";
import { createExportRouter } from "../../backend/routes/exports";
import type { ProductionStorageProvider } from "../../backend/artifacts/productionStorageProvider";
import type { ProductionArtifactStorageRefResolver } from "../../backend/artifacts/productionArtifactStorageRefResolver";

const baseRecord = {
  jobId: "job-phase7-storage",
  requestId: "request-phase7-storage",
  timelineId: "timeline-phase7-storage",
  ownerId: "owner-phase7-storage",
  workspaceId: "workspace-phase7-storage",
  status: "success" as const,
  attemptCount: 1,
  createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  completedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  renderSettings: {
    format: "mp4" as const,
    resolution: "720p" as const,
    fps: 30 as const,
    quality: "draft" as const,
  },
};

const createRegistry = (artifacts: unknown[]): ExportJobRegistry =>
  ({
    create: async (input: any) => ({
      ...baseRecord,
      requestId: input.requestId,
      timelineId: input.timelineId,
      ownerId: input.ownerId,
      workspaceId: input.workspaceId,
      renderSettings: input.renderSettings,
      artifacts,
    }),
    getById: async () => ({ ...baseRecord, artifacts }),
    getByIdForOwner: async () => ({ ...baseRecord, artifacts }),
    getByRequestId: async () => undefined,
    getByStatus: async () => [{ ...baseRecord, artifacts }],
    claim: async () => {
      throw new Error("claim should not be called");
    },
    markRendering: async () => {
      throw new Error("markRendering should not be called");
    },
    markFinalizing: async () => {
      throw new Error("markFinalizing should not be called");
    },
    markSuccess: async () => {
      throw new Error("markSuccess should not be called");
    },
    markError: async () => {
      throw new Error("markError should not be called");
    },
    transition: async () => {
      throw new Error("transition should not be called");
    },
  }) as unknown as ExportJobRegistry;

const requesterContextResolver = () => ({
  ownerId: baseRecord.ownerId,
  workspaceId: baseRecord.workspaceId,
  authMode: "local_dev_fallback" as const,
});

const startServer = async (
  registry: ExportJobRegistry,
  options?: {
    trustedRequesterContext?: unknown;
    productionStorageProvider?: ProductionStorageProvider;
    productionArtifactStorageRefResolver?: ProductionArtifactStorageRefResolver;
  },
): Promise<{ server: Server; baseUrl: string }> => {
  const app = express();
  app.use(express.json());

  if (options?.trustedRequesterContext) {
    app.use((request, _response, next) => {
      (request as { backendRequesterContext?: unknown }).backendRequesterContext =
        options.trustedRequesterContext;
      next();
    });
  }

  app.use(
    createExportRouter(registry, {
      authorizationMode: "enforce",
      requesterContextResolver,
      ...(options?.productionStorageProvider
        ? { productionStorageProvider: options.productionStorageProvider }
        : {}),
      ...(options?.productionArtifactStorageRefResolver
        ? {
            productionArtifactStorageRefResolver:
              options.productionArtifactStorageRefResolver,
          }
        : {}),
    }),
  );

  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve test server address.");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
};

const stopServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

test.describe("product phase 7 storage and signed delivery boundary", () => {
  test("signed URL TTL stays capped and the default signed provider fails closed", async () => {
    expect(DEFAULT_SIGNED_URL_EXPIRES_IN_SECONDS).toBe(300);
    expect(MAX_SIGNED_URL_EXPIRES_IN_SECONDS).toBe(300);
    expect(
      resolveSignedUrlExpiresAt(
        new Date("2026-01-01T00:00:00.000Z"),
        DEFAULT_SIGNED_URL_EXPIRES_IN_SECONDS,
      ),
    ).toBe("2026-01-01T00:05:00.000Z");
    expect(
      resolveSignedUrlExpiresAt(
        new Date("2026-01-01T00:00:00.000Z"),
        MAX_SIGNED_URL_EXPIRES_IN_SECONDS + 1,
      ),
    ).toBeUndefined();

    const result = await createSignedUrlDeliveryNotConfiguredProvider().generateSignedUrl({
      artifactId: "artifact-phase7",
      storageRef: {
        provider: "supabase_storage",
        bucket: "exports",
        objectKey: "workspace/job/artifact.mp4",
      },
    });

    expect(result).toEqual({
      kind: "unavailable",
      reason: "not_configured",
    });
  });

  test("descriptor route remains unavailable by default and rejects missing refs unsafe refs and unverified storage objects", async () => {
    const trustedRequesterContext = {
      kind: "authenticated" as const,
      userId: baseRecord.ownerId,
      workspaceId: baseRecord.workspaceId,
      authProvider: "jwt",
      authSubject: baseRecord.ownerId,
    };

    const productionStorageProvider: ProductionStorageProvider = {
      verifyObject: async () => ({
        kind: "unavailable",
        reason: "object_not_found",
      }),
    };

    const resolverWithoutRef: ProductionArtifactStorageRefResolver = {
      resolveStorageRef: async () => undefined,
    };

    const { server, baseUrl } = await startServer(
      createRegistry([
        {
          artifactId: "artifact-missing-ref",
          jobId: baseRecord.jobId,
          kind: "render_output",
          format: "mp4",
          status: "available",
          createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        },
        {
          artifactId: "artifact-unsafe-ref",
          jobId: baseRecord.jobId,
          kind: "render_output",
          format: "mp4",
          status: "available",
          createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
          storageRef: {
            provider: "supabase_storage",
            bucket: "exports",
            objectKey: "C:\\unsafe\\artifact.mp4",
          },
        },
        {
          artifactId: "artifact-unverified-object",
          jobId: baseRecord.jobId,
          kind: "render_output",
          format: "mp4",
          status: "available",
          createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
          storageRef: {
            provider: "supabase_storage",
            bucket: "exports",
            objectKey: "workspace/job/unverified.mp4",
          },
        },
      ]),
      {
        trustedRequesterContext,
        productionStorageProvider,
        productionArtifactStorageRefResolver: resolverWithoutRef,
      },
    );

    try {
      const missingRefResponse = await fetch(
        `${baseUrl}/exports/${baseRecord.jobId}/artifacts/artifact-missing-ref/delivery`,
      );
      expect(missingRefResponse.status).toBe(200);
      await expect(missingRefResponse.json()).resolves.toEqual({
        kind: "artifact_delivery_unavailable",
        reason: "storage_not_configured",
      });

      const unsafeRefResponse = await fetch(
        `${baseUrl}/exports/${baseRecord.jobId}/artifacts/artifact-unsafe-ref/delivery`,
      );
      expect(unsafeRefResponse.status).toBe(200);
      const unsafePayload = (await unsafeRefResponse.json()) as Record<string, unknown>;
      expect(unsafePayload).toEqual({
        kind: "artifact_delivery_unavailable",
        reason: "storage_not_configured",
      });
      expect(unsafePayload).not.toHaveProperty("signedUrl");
      expect(unsafePayload).not.toHaveProperty("url");

      const unverifiedObjectResponse = await fetch(
        `${baseUrl}/exports/${baseRecord.jobId}/artifacts/artifact-unverified-object/delivery`,
      );
      expect(unverifiedObjectResponse.status).toBe(200);
      await expect(unverifiedObjectResponse.json()).resolves.toEqual({
        kind: "artifact_delivery_unavailable",
        reason: "storage_not_configured",
      });
    } finally {
      await stopServer(server);
    }
  });

  test("local dev artifact stream access remains gated unless explicitly wired", async () => {
    const trustedRequesterContext = {
      kind: "authenticated" as const,
      userId: baseRecord.ownerId,
      workspaceId: baseRecord.workspaceId,
      authProvider: "jwt",
      authSubject: baseRecord.ownerId,
    };

    const { server, baseUrl } = await startServer(
      createRegistry([
        {
          artifactId: "artifact-local-dev-gated",
          jobId: baseRecord.jobId,
          kind: "render_output",
          format: "mp4",
          status: "available",
          createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        },
      ]),
      {
        trustedRequesterContext,
      },
    );

    try {
      const accessResponse = await fetch(
        `${baseUrl}/exports/${baseRecord.jobId}/artifacts/artifact-local-dev-gated/access`,
      );
      expect(accessResponse.status).toBe(200);
      const payload = (await accessResponse.json()) as Record<string, unknown>;
      expect(payload.kind).toBe("artifact_access_unavailable");
      expect(payload.reason).toBe("artifact_access_not_configured");
      expect(String(payload.message ?? "")).toContain(
        "Artifact access is not configured.",
      );
    } finally {
      await stopServer(server);
    }
  });
});
