import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase154 timeline export panel descriptor ui wiring audit pack", () => {
  test("timeline panel wiring audit document defines safe future panel wiring requirements", async () => {
    const auditSource = readSource(
      "docs/security/phase154-timeline-export-panel-descriptor-ui-wiring-audit.md",
    );

    expect(auditSource).toContain("Status: audit only");
    expect(auditSource).toContain("ArtifactDeliveryDescriptorAction");
    expect(auditSource).toContain("TimelineExportPanel is not wired yet");
    expect(auditSource).toContain("Keep React components render/dispatch-only");
    expect(auditSource).toContain("Avoid direct fetch calls in TimelineExportPanel");
    expect(auditSource).toContain("Avoid constructing stream/download URLs in TimelineExportPanel");
    expect(auditSource).toContain("Phase 155");
  });

  test("descriptor UI boundaries exist while TimelineExportPanel wiring remains deferred", async () => {
    const timelinePanelSource = readIfExists("src/components/TimelineExportPanel.tsx");
    const descriptorActionSource = readSource("src/components/ArtifactDeliveryDescriptorAction.tsx");
    const downloadActionSource = readSource("src/components/ArtifactDownloadAction.tsx");
    const descriptorStoreSource = readSource("src/store/artifactDeliveryDescriptorStore.ts");
    const descriptorServiceSource = readSource("src/services/artifactDeliveryDescriptorService.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    expect(routeSource).toContain('"/exports/:jobId/artifacts/:artifactId/delivery"');
    expect(routeSource).toContain("resolveBackendMediatedArtifactDelivery");

    expect(descriptorServiceSource).toContain("getArtifactDeliveryDescriptor");
    expect(descriptorStoreSource).toContain("useArtifactDeliveryDescriptorStore");
    expect(descriptorStoreSource).toContain("requestArtifactDeliveryDescriptor");

    expect(downloadActionSource).toContain("ArtifactDownloadAction");
    expect(descriptorActionSource).toContain("ArtifactDeliveryDescriptorAction");
    expect(descriptorActionSource).toContain("ArtifactDownloadAction");
    expect(descriptorActionSource).toContain("requestArtifactDeliveryDescriptor");

    // Phase 154 is audit-only. Main panel wiring exists after Phase 155, but remains render/dispatch-only.
    expect(timelinePanelSource).toContain("ArtifactDeliveryDescriptorAction");
    expect(timelinePanelSource).not.toContain("useArtifactDeliveryDescriptorStore");
    expect(timelinePanelSource).not.toContain("requestArtifactDeliveryDescriptor");
    expect(timelinePanelSource).not.toContain("getArtifactDeliveryDescriptor");
  });

  test("timeline panel audit does not add navigation storage signed url or public delivery behavior", async () => {
    const timelinePanelSource = readIfExists("src/components/TimelineExportPanel.tsx");

    const frontendSource =
      timelinePanelSource +
      "\n" +
      readSource("src/components/ArtifactDeliveryDescriptorAction.tsx") +
      "\n" +
      readSource("src/components/ArtifactDownloadAction.tsx") +
      "\n" +
      readSource("src/services/artifactDownloadUiState.ts") +
      "\n" +
      readSource("src/store/artifactDeliveryDescriptorStore.ts") +
      "\n" +
      readSource("src/services/artifactDeliveryDescriptorService.ts") +
      "\n" +
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
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

    const routeSource = readSource("backend/routes/exports.ts");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");
    expect(frontendSource).not.toContain("document.createElement");
    expect(frontendSource).not.toContain(".click()");

    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("getPublicUrl");
    expect(artifactSource).not.toContain("service_role");
    expect(artifactSource).not.toContain("SERVICE_ROLE");
    expect(artifactSource).not.toContain("production_ready_public_delivery");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
  });
});


