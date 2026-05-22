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

test.describe("phase166 production storage provider route precondition integration audit pack", () => {
  test("audit document defines safe future route and precondition integration requirements", async () => {
    const auditSource = readSource(
      "docs/security/phase166-production-storage-provider-route-precondition-integration-audit.md",
    );

    expect(auditSource).toContain("Status: audit only");
    expect(auditSource).toContain("ProductionStorageProvider boundary exists");
    expect(auditSource).toContain("providerConfigured remains false");
    expect(auditSource).toContain("providerCanResolve remains false");
    expect(auditSource).toContain("Resolve storage refs only from trusted backend artifact metadata");
    expect(auditSource).toContain("Never trust frontend-provided storage refs");
    expect(auditSource).toContain("Never generate signed/public URLs");
    expect(auditSource).toContain("Phase 167 should add a production storage provider integration boundary only");
  });

  test("production storage provider boundary remains fail-closed and validates refs without route integration", async () => {
    const provider = createProductionStorageNotConfiguredProvider();

    const result = await provider.verifyObject({
      artifactId: "artifact-phase166",
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

    expect(isProductionStorageObjectVerified(result)).toBe(false);

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
        bucket: "exports",
        objectKey: "../artifact.mp4",
      }),
    ).toBe(false);
  });

  test("storage provider integration is not route wired and adds no delivery shortcuts", async () => {
    const storageProviderSource = readSource("backend/artifacts/productionStorageProvider.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    const backendArtifactSource =
      storageProviderSource +
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

    expect(storageProviderSource).toContain("ProductionStorageProvider");
    expect(storageProviderSource).toContain("createProductionStorageNotConfiguredProvider");
    expect(storageProviderSource).toContain("isValidProductionArtifactStorageReference");

    expect(routeSource).toContain("decideArtifactDeliveryReadyPreconditions");
    expect(routeSource).toContain("providerConfigured: false");
    expect(routeSource).toContain("providerCanResolve: false");

    // Phase 166 is audit-only. Route/provider integration remains deferred.
    expect(routeSource).not.toContain("createProductionStorageNotConfiguredProvider");
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
