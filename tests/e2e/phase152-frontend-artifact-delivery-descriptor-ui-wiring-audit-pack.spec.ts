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

test.describe("phase152 frontend artifact delivery descriptor ui wiring audit pack", () => {
  test("ui wiring audit document defines future safe ui wiring requirements", async () => {
    const auditSource = readSource(
      "docs/security/phase152-frontend-artifact-delivery-descriptor-ui-wiring-audit.md",
    );

    expect(auditSource).toContain("Status: audit only");
    expect(auditSource).toContain("Use artifactDeliveryDescriptorStore only");
    expect(auditSource).toContain("Render loading/unavailable/error/ready states truthfully");
    expect(auditSource).toContain("Keep React components render/dispatch only");
    expect(auditSource).toContain("Avoid component-owned fetch orchestration");
    expect(auditSource).toContain("Avoid window.open");
    expect(auditSource).toContain("Phase 153");
  });

  test("descriptor route service store and ui boundary exist but TimelineExportPanel wiring remains deferred", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const serviceSource = readSource("src/services/artifactDeliveryDescriptorService.ts");
    const storeSource = readSource("src/store/artifactDeliveryDescriptorStore.ts");
    const actionSource = readSource("src/components/ArtifactDownloadAction.tsx");
    const timelinePanelSource = readIfExists("src/components/TimelineExportPanel.tsx");

    expect(routeSource).toContain('"/exports/:jobId/artifacts/:artifactId/delivery"');
    expect(routeSource).toContain("resolveBackendMediatedArtifactDelivery");

    expect(serviceSource).toContain("getArtifactDeliveryDescriptor");
    expect(serviceSource).toContain("parseArtifactDeliveryDescriptorPayload");

    expect(storeSource).toContain("useArtifactDeliveryDescriptorStore");
    expect(storeSource).toContain("requestArtifactDeliveryDescriptor");
    expect(storeSource).toContain("getArtifactDeliveryDescriptor");

    expect(actionSource).toContain("ArtifactDownloadAction");
    expect(actionSource).toContain("onRequestDownload");
    expect(actionSource).toContain("getArtifactDownloadUiState");

    // Phase 152 is audit-only. Main export UI wiring remains deferred.
    expect(timelinePanelSource).not.toContain("ArtifactDownloadAction");
    expect(timelinePanelSource).not.toContain("useArtifactDeliveryDescriptorStore");
    expect(timelinePanelSource).not.toContain("requestArtifactDeliveryDescriptor");
    expect(timelinePanelSource).not.toContain("getArtifactDeliveryDescriptor");
  });

  test("ui wiring audit does not add navigation storage signed url or public delivery behavior", async () => {
    const frontendSource =
      readSource("src/services/artifactDeliveryDescriptorService.ts") +
      "\n" +
      readSource("src/store/artifactDeliveryDescriptorStore.ts") +
      "\n" +
      readSource("src/components/ArtifactDownloadAction.tsx") +
      "\n" +
      readSource("src/services/artifactDownloadUiState.ts") +
      "\n" +
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
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
