import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getArtifactDownloadUiState } from "../../src/services/artifactDownloadUiState";
import { parseArtifactDeliveryDescriptorPayload } from "../../src/services/artifactDeliveryDescriptorService";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase162 browser download navigation final audit pack", () => {
  test("browser download navigation audit document defines future safety requirements without implementation", async () => {
    const auditSource = readSource(
      "docs/security/phase162-browser-download-navigation-final-audit.md",
    );

    expect(auditSource).toContain("Status: audit only");
    expect(auditSource).toContain("Backend descriptor route can safely return ready");
    expect(auditSource).toContain("Ready descriptors must be backend-mediated only");
    expect(auditSource).toContain("Frontend must not construct stream/download URLs manually");
    expect(auditSource).toContain("Download behavior must be user-triggered only");
    expect(auditSource).toContain("window.open");
    expect(auditSource).toContain("location.href");
    expect(auditSource).toContain("Phase 163");
  });

  test("frontend can represent ready descriptor state but still does not perform browser navigation", async () => {
    const readyDescriptor = parseArtifactDeliveryDescriptorPayload({
      kind: "artifact_delivery_ready",
      deliveryMode: "backend_mediated",
      jobId: "job-phase162",
      artifactId: "artifact-phase162",
      backendRoutePath: "/exports/job-phase162/artifacts/artifact-phase162/stream",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });

    expect(readyDescriptor).toEqual({
      kind: "ready",
      deliveryMode: "backend_mediated",
      jobId: "job-phase162",
      artifactId: "artifact-phase162",
      backendRoutePath: "/exports/job-phase162/artifacts/artifact-phase162/stream",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });

    expect(getArtifactDownloadUiState(readyDescriptor)).toEqual({
      kind: "ready",
      label: "Download artifact",
      descriptor: readyDescriptor,
    });

    expect(
      getArtifactDownloadUiState({
        kind: "unavailable",
        reason: "workspace_or_rls_not_ready",
      }),
    ).toEqual({
      kind: "disabled",
      label: "Download unavailable",
      reason: "workspace_or_rls_not_ready",
    });
  });

  test("browser download navigation remains blocked in frontend backend and artifact runtime sources", async () => {
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
