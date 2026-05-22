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

test.describe("phase155 timeline export panel descriptor ui wiring pack", () => {
  test("TimelineExportPanel wires descriptor action through render dispatch boundary", async () => {
    const panelSource = readSource("src/components/TimelineExportPanel.tsx");
    const descriptorActionSource = readSource("src/components/ArtifactDeliveryDescriptorAction.tsx");

    expect(panelSource).toContain("ArtifactDeliveryDescriptorAction");
    expect(panelSource).toContain("Phase 155 artifact delivery descriptor UI wiring");
    expect(panelSource).toContain("artifact.id");
    expect(panelSource).toContain("exportHandle.jobId");
    expect(panelSource).toContain("timeline-export-artifact-delivery");
    expect(panelSource).not.toContain("getArtifactDeliveryDescriptor(");
    expect(panelSource).not.toContain("fetch(");

    expect(descriptorActionSource).toContain("requestArtifactDeliveryDescriptor");
    expect(descriptorActionSource).toContain("ArtifactDownloadAction");
  });

  test("TimelineExportPanel wiring does not add browser navigation or direct storage behavior", async () => {
    const frontendSource =
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

  test("backend delivery remains descriptor-only without signed public url behavior", async () => {
    const routeSource = readSource("backend/routes/exports.ts");

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

    expect(routeSource).toContain('"/exports/:jobId/artifacts/:artifactId/delivery"');
    expect(routeSource).toContain("resolveBackendMediatedArtifactDelivery");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("createSignedUrl");
    expect(routeSource).not.toContain("getPublicUrl");

    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("getPublicUrl");
    expect(artifactSource).not.toContain("service_role");
    expect(artifactSource).not.toContain("SERVICE_ROLE");
    expect(artifactSource).not.toContain("production_ready_public_delivery");
  });
});
