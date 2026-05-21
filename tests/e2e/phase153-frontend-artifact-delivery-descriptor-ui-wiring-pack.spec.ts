import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { mapDescriptorStoreEntryToDownloadDescriptor } from "../../src/components/ArtifactDeliveryDescriptorAction";
import type { ArtifactDeliveryDescriptorStoreEntry } from "../../src/store/artifactDeliveryDescriptorStore";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase153 frontend artifact delivery descriptor ui wiring pack", () => {
  test("descriptor ui mapping converts store state into download action descriptors", async () => {
    const readyEntry: ArtifactDeliveryDescriptorStoreEntry = {
      kind: "ready",
      deliveryMode: "backend_mediated",
      jobId: "job-phase153",
      artifactId: "artifact-phase153",
      backendRoutePath: "/exports/job-phase153/artifacts/artifact-phase153/stream",
      expiresAt: "2026-01-01T00:05:00.000Z",
    };

    expect(mapDescriptorStoreEntryToDownloadDescriptor(readyEntry)).toEqual({
      kind: "ready",
      deliveryMode: "backend_mediated",
      jobId: "job-phase153",
      artifactId: "artifact-phase153",
      backendRoutePath: "/exports/job-phase153/artifacts/artifact-phase153/stream",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });

    expect(
      mapDescriptorStoreEntryToDownloadDescriptor({
        kind: "unavailable",
        jobId: "job-phase153",
        artifactId: "artifact-phase153",
        reason: "workspace_or_rls_not_ready",
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "workspace_or_rls_not_ready",
    });

    expect(
      mapDescriptorStoreEntryToDownloadDescriptor({
        kind: "idle",
      }),
    ).toBeUndefined();

    expect(
      mapDescriptorStoreEntryToDownloadDescriptor({
        kind: "error",
        jobId: "job-phase153",
        artifactId: "artifact-phase153",
        reason: "forbidden",
        status: 403,
      }),
    ).toBeUndefined();
  });

  test("descriptor ui component wires store action to render-dispatch boundary only", async () => {
    const componentSource = readSource("src/components/ArtifactDeliveryDescriptorAction.tsx");
    const downloadActionSource = readSource("src/components/ArtifactDownloadAction.tsx");
    const storeSource = readSource("src/store/artifactDeliveryDescriptorStore.ts");

    expect(componentSource).toContain("ArtifactDeliveryDescriptorAction");
    expect(componentSource).toContain("useArtifactDeliveryDescriptorStore");
    expect(componentSource).toContain("requestArtifactDeliveryDescriptor");
    expect(componentSource).toContain("ArtifactDownloadAction");
    expect(componentSource).toContain("onRequestDownload");
    expect(componentSource).toContain("Check delivery descriptor");

    expect(downloadActionSource).toContain("ArtifactDownloadAction");
    expect(storeSource).toContain("requestArtifactDeliveryDescriptor");

    const uiWiringSource = componentSource + "\n" + downloadActionSource + "\n" + storeSource;

    expect(uiWiringSource).not.toContain("window.open");
    expect(uiWiringSource).not.toContain("location.href");
    expect(uiWiringSource).not.toContain("document.createElement");
    expect(uiWiringSource).not.toContain(".click()");
    expect(uiWiringSource).not.toContain("@supabase/supabase-js");
    expect(uiWiringSource).not.toContain("createClient(");
    expect(uiWiringSource).not.toContain(".storage.from(");
    expect(uiWiringSource).not.toContain("createSignedUrl");
    expect(uiWiringSource).not.toContain("getPublicUrl");
  });

  test("descriptor ui wiring is not main panel wired and public delivery stays blocked", async () => {
    const descriptorComponentSource = readSource("src/components/ArtifactDeliveryDescriptorAction.tsx");
    const timelinePanelSource = readIfExists("src/components/TimelineExportPanel.tsx");
    const routeSource = readSource("backend/routes/exports.ts");

    const frontendSource =
      descriptorComponentSource +
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
      timelinePanelSource +
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

    expect(descriptorComponentSource).toContain("ArtifactDeliveryDescriptorAction");
    expect(routeSource).toContain('"/exports/:jobId/artifacts/:artifactId/delivery"');

    // Phase 153 adds a safe reusable UI wiring component only.
    expect(timelinePanelSource).not.toContain("ArtifactDeliveryDescriptorAction");
    expect(timelinePanelSource).not.toContain("useArtifactDeliveryDescriptorStore");

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
  });
});
