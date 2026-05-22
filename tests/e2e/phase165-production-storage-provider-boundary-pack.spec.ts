import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createProductionStorageNotConfiguredProvider,
  isProductionStorageObjectVerified,
  isValidProductionArtifactStorageReference,
} from "../../backend/artifacts/productionStorageProvider";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase165 production storage provider boundary pack", () => {
  test("not-configured production storage provider fails closed without fake verification", async () => {
    const provider = createProductionStorageNotConfiguredProvider();

    const result = await provider.verifyObject({
      artifactId: "artifact-phase165",
      storageRef: {
        provider: "supabase_storage",
        bucket: "exports",
        objectKey: "workspace/job/artifact.mp4",
        contentType: "video/mp4",
        sizeBytes: 1024,
      },
    });

    expect(result).toEqual({
      kind: "unavailable",
      reason: "not_configured",
    });

    expect(isProductionStorageObjectVerified(result)).toBe(false);
  });

  test("production storage reference validation rejects local paths and unsafe object keys", async () => {
    expect(
      isValidProductionArtifactStorageReference({
        provider: "supabase_storage",
        bucket: "exports",
        objectKey: "workspace/job/artifact.mp4",
      }),
    ).toBe(true);

    expect(
      isValidProductionArtifactStorageReference({
        provider: "supabase_storage",
        bucket: "",
        objectKey: "workspace/job/artifact.mp4",
      }),
    ).toBe(false);

    expect(
      isValidProductionArtifactStorageReference({
        provider: "supabase_storage",
        bucket: "exports",
        objectKey: "",
      }),
    ).toBe(false);

    for (const unsafeObjectKey of [
      "../artifact.mp4",
      "workspace\\artifact.mp4",
      "file://artifact.mp4",
      "C:/artifact.mp4",
      "/Users/project/artifact.mp4",
      "/home/project/artifact.mp4",
      "/tmp/artifact.mp4",
      "rootPath/artifact.mp4",
      "directoryPath/artifact.mp4",
      "filePath/artifact.mp4",
      "localPath/artifact.mp4",
      "filesystemPath/artifact.mp4",
    ]) {
      expect(
        isValidProductionArtifactStorageReference({
          provider: "supabase_storage",
          bucket: "exports",
          objectKey: unsafeObjectKey,
        }),
      ).toBe(false);
    }
  });

  test("production storage provider boundary is not route wired and adds no delivery shortcuts", async () => {
    const providerSource = readSource("backend/artifacts/productionStorageProvider.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    const backendArtifactSource =
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

    expect(providerSource).toContain("ProductionStorageProvider");
    expect(providerSource).toContain("createProductionStorageNotConfiguredProvider");
    expect(providerSource).toContain("isValidProductionArtifactStorageReference");
    expect(providerSource).toContain("not_configured");

    // Phase 165 is boundary-only. Route integration remains deferred.
    expect(routeSource).not.toContain("createProductionStorageNotConfiguredProvider");
    expect(routeSource).not.toContain("ProductionStorageProvider");
    expect(routeSource).toContain("providerConfigured: false");
    expect(routeSource).toContain("providerCanResolve: false");

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
