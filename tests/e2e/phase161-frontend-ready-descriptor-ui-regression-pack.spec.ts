import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArtifactDeliveryDescriptorPayload } from "../../src/services/artifactDeliveryDescriptorService";
import { getArtifactDownloadUiState } from "../../src/services/artifactDownloadUiState";
import { mapDescriptorStoreEntryToDownloadDescriptor } from "../../src/components/ArtifactDeliveryDescriptorAction";
import type { ArtifactDeliveryDescriptorStoreEntry } from "../../src/store/artifactDeliveryDescriptorStore";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase161 frontend ready descriptor ui regression pack", () => {
  test("frontend maps backend-mediated ready descriptor through service store mapping and ui state", async () => {
    const serviceResult = parseArtifactDeliveryDescriptorPayload({
      kind: "artifact_delivery_ready",
      deliveryMode: "backend_mediated",
      jobId: "job-phase161",
      artifactId: "artifact-phase161",
      backendRoutePath: "/exports/job-phase161/artifacts/artifact-phase161/stream",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });

    expect(serviceResult).toEqual({
      kind: "ready",
      deliveryMode: "backend_mediated",
      jobId: "job-phase161",
      artifactId: "artifact-phase161",
      backendRoutePath: "/exports/job-phase161/artifacts/artifact-phase161/stream",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });

    const storeEntry: ArtifactDeliveryDescriptorStoreEntry = {
      kind: "ready",
      deliveryMode: "backend_mediated",
      jobId: "job-phase161",
      artifactId: "artifact-phase161",
      backendRoutePath: "/exports/job-phase161/artifacts/artifact-phase161/stream",
      expiresAt: "2026-01-01T00:05:00.000Z",
    };

    const downloadDescriptor = mapDescriptorStoreEntryToDownloadDescriptor(storeEntry);

    expect(downloadDescriptor).toEqual({
      kind: "ready",
      deliveryMode: "backend_mediated",
      jobId: "job-phase161",
      artifactId: "artifact-phase161",
      backendRoutePath: "/exports/job-phase161/artifacts/artifact-phase161/stream",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });

    expect(getArtifactDownloadUiState(downloadDescriptor)).toEqual({
      kind: "ready",
      label: "Download artifact",
      descriptor: downloadDescriptor,
    });
  });

  test("frontend does not fabricate ready descriptor from unavailable error idle or invalid payload states", async () => {
    expect(
      parseArtifactDeliveryDescriptorPayload({
        kind: "artifact_delivery_unavailable",
        reason: "workspace_or_rls_not_ready",
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "workspace_or_rls_not_ready",
    });

    expect(parseArtifactDeliveryDescriptorPayload({ kind: "unknown" })).toEqual({
      kind: "error",
      reason: "invalid_response",
    });

    expect(
      mapDescriptorStoreEntryToDownloadDescriptor({
        kind: "idle",
      }),
    ).toBeUndefined();

    expect(
      mapDescriptorStoreEntryToDownloadDescriptor({
        kind: "error",
        jobId: "job-phase161",
        artifactId: "artifact-phase161",
        reason: "forbidden",
        status: 403,
      }),
    ).toBeUndefined();

    expect(
      getArtifactDownloadUiState({
        kind: "unavailable",
        reason: "storage_not_configured",
      }),
    ).toEqual({
      kind: "disabled",
      label: "Download unavailable",
      reason: "storage_not_configured",
    });
  });

  test("ready descriptor ui regression does not add browser navigation storage signed url or public delivery behavior", async () => {
    const frontendSource =
      readSource("src/components/TimelineExportPanel.tsx") +
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

    const routeSource = readSource("backend/routes/exports.ts");

    const backendArtifactSource =
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

    expect(frontendSource).toContain("ArtifactDeliveryDescriptorAction");
    expect(frontendSource).toContain("ArtifactDownloadAction");
    expect(frontendSource).toContain("Download artifact");
    expect(frontendSource).toContain("backend_mediated");

    expect(routeSource).toContain("decideArtifactDeliveryReadyPreconditions");
    expect(routeSource).toContain("workspaceMembershipOrRlsReady: false");
    expect(routeSource).toContain("providerConfigured: false");
    expect(routeSource).toContain("providerCanResolve: false");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");
    expect(frontendSource).not.toContain("document.createElement");
    expect(frontendSource).not.toContain(".click()");

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
  });
});
