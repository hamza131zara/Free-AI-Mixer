import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getArtifactDownloadUiState } from "../../src/services/artifactDownloadUiState";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase147 frontend download ui pack", () => {
  test("download ui state stays disabled until backend-mediated descriptor is ready", async () => {
    expect(getArtifactDownloadUiState()).toEqual({
      kind: "disabled",
      label: "Download unavailable",
      reason: "no_descriptor",
    });

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

    const readyDescriptor = {
      kind: "ready" as const,
      deliveryMode: "backend_mediated" as const,
      jobId: "job-phase147",
      artifactId: "artifact-phase147",
      backendRoutePath: "/exports/job-phase147/artifacts/artifact-phase147/stream",
      expiresAt: "2026-01-01T00:05:00.000Z",
    };

    expect(getArtifactDownloadUiState(readyDescriptor)).toEqual({
      kind: "ready",
      label: "Download artifact",
      descriptor: readyDescriptor,
    });
  });

  test("download ui component renders and dispatches only without navigation behavior", async () => {
    const componentSource = readSource("src/components/ArtifactDownloadAction.tsx");
    const helperSource = readSource("src/services/artifactDownloadUiState.ts");

    expect(componentSource).toContain("ArtifactDownloadAction");
    expect(componentSource).toContain("onRequestDownload");
    expect(componentSource).toContain("getArtifactDownloadUiState");
    expect(helperSource).toContain("Download artifact");
    expect(helperSource).toContain("Download unavailable");

    expect(helperSource).toContain("ArtifactDownloadDescriptor");
    expect(helperSource).toContain('deliveryMode: "backend_mediated"');
    expect(helperSource).toContain("backendRoutePath");

    const frontendDownloadSource = componentSource + "\n" + helperSource;

    expect(frontendDownloadSource).not.toContain("window.open");
    expect(frontendDownloadSource).not.toContain("location.href");
    expect(frontendDownloadSource).not.toContain("document.createElement");
    expect(frontendDownloadSource).not.toContain(".click()");
    expect(frontendDownloadSource).not.toContain("@supabase/supabase-js");
    expect(frontendDownloadSource).not.toContain("createClient(");
    expect(frontendDownloadSource).not.toContain(".storage.from(");
    expect(frontendDownloadSource).not.toContain("createSignedUrl");
    expect(frontendDownloadSource).not.toContain("getPublicUrl");
  });

  test("frontend download ui is not wired to routes storage or public delivery yet", async () => {
    const routeSource = readSource("backend/routes/exports.ts");

    const frontendSource =
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/components/TimelineExportPanel.tsx") +
      "\n" +
      readSource("src/components/ArtifactDownloadAction.tsx") +
      "\n" +
      readSource("src/services/artifactDownloadUiState.ts") +
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

    expect(frontendSource).toContain("ArtifactDownloadAction");
    expect(frontendSource).toContain("getArtifactDownloadUiState");

    expect(routeSource).not.toContain("resolveBackendMediatedArtifactDelivery");
    expect(routeSource).not.toContain("createProductionArtifactDeliveryNotConfiguredProvider");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");

    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("getPublicUrl");
    expect(artifactSource).not.toContain("service_role");
    expect(artifactSource).not.toContain("SERVICE_ROLE");
    expect(artifactSource).not.toContain("production_ready_public_delivery");
  });
});

