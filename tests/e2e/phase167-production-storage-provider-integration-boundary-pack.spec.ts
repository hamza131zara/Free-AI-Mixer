import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
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

const validStorageRef = {
  provider: "supabase_storage" as const,
  bucket: "exports",
  objectKey: "workspace/job/artifact.mp4",
  contentType: "video/mp4",
  sizeBytes: 1024,
};

test.describe("phase167 production storage provider integration boundary pack", () => {
  test("production storage readiness fails closed for missing invalid and not-configured provider states", async () => {
    await expect(
      resolveProductionStorageReadiness({
        artifactId: "artifact-phase167",
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "missing_storage_ref",
      providerConfigured: false,
      providerCanResolve: false,
    });

    await expect(
      resolveProductionStorageReadiness({
        artifactId: "artifact-phase167",
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
        artifactId: "artifact-phase167",
        storageRef: validStorageRef,
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "provider_not_configured",
      providerConfigured: false,
      providerCanResolve: false,
    });
  });

  test("production storage readiness can map a verified backend-only provider result to ready", async () => {
    const provider: ProductionStorageProvider = {
      verifyObject: async ({ storageRef }) => ({
        kind: "verified",
        provider: storageRef.provider,
        bucket: storageRef.bucket,
        objectKey: storageRef.objectKey,
        contentType: storageRef.contentType,
        sizeBytes: storageRef.sizeBytes,
      }),
    };

    await expect(
      resolveProductionStorageReadiness({
        artifactId: "artifact-phase167",
        storageRef: validStorageRef,
        provider,
      }),
    ).resolves.toEqual({
      kind: "ready",
      providerConfigured: true,
      providerCanResolve: true,
      verification: {
        kind: "verified",
        provider: "supabase_storage",
        bucket: "exports",
        objectKey: "workspace/job/artifact.mp4",
        contentType: "video/mp4",
        sizeBytes: 1024,
      },
    });

    const unavailableProvider: ProductionStorageProvider = {
      verifyObject: async () => ({
        kind: "unavailable",
        reason: "object_not_found",
      }),
    };

    await expect(
      resolveProductionStorageReadiness({
        artifactId: "artifact-phase167",
        storageRef: validStorageRef,
        provider: unavailableProvider,
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "object_not_found",
      providerConfigured: false,
      providerCanResolve: false,
    });
  });

  test("production storage integration boundary is not route wired and adds no delivery shortcuts", async () => {
    const integrationSource = readSource("backend/artifacts/productionStorageProviderIntegration.ts");
    const providerSource = readSource("backend/artifacts/productionStorageProvider.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    const backendArtifactSource =
      integrationSource +
      "\n" +
      providerSource +
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

    expect(integrationSource).toContain("resolveProductionStorageReadiness");
    expect(integrationSource).toContain("createProductionStorageNotConfiguredProvider");
    expect(integrationSource).toContain("isValidProductionArtifactStorageReference");
    expect(integrationSource).toContain("providerConfigured");
    expect(integrationSource).toContain("providerCanResolve");

    expect(routeSource).toContain("decideArtifactDeliveryReadyPreconditions");
    expect(routeSource).toContain("providerConfigured: false");
    expect(routeSource).toContain("providerCanResolve: false");

    // Phase 167 is boundary-only. Route/provider integration remains deferred.
    expect(routeSource).not.toContain("resolveProductionStorageReadiness");
    expect(routeSource).not.toContain("ProductionStorageProvider");
    expect(routeSource).not.toContain("verifyObject(");
    expect(routeSource).not.toContain("isValidProductionArtifactStorageReference");

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
