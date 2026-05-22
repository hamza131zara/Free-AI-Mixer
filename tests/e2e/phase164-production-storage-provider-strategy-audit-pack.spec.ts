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

test.describe("phase164 production storage provider strategy audit pack", () => {
  test("production storage provider strategy audit document defines safe provider requirements", async () => {
    const auditSource = readSource(
      "docs/security/phase164-production-storage-provider-strategy-audit.md",
    );

    expect(auditSource).toContain("Status: audit only");
    expect(auditSource).toContain("Supabase Storage");
    expect(auditSource).toContain("backend-only production storage provider boundary");
    expect(auditSource).toContain("no frontend storage SDK");
    expect(auditSource).toContain("Never expose service-role secrets");
    expect(auditSource).toContain("Avoid signed URLs until a signed URL provider phase is approved");
    expect(auditSource).toContain("Phase 165 should add a production storage provider boundary only");
  });

  test("existing artifact provider boundaries remain fail-closed and no production storage provider is implemented", async () => {
    const productionProviderSource = readIfExists(
      "backend/artifacts/productionArtifactDeliveryProvider.ts",
    );
    const backendMediatedSource = readSource(
      "backend/artifacts/backendMediatedArtifactDelivery.ts",
    );
    const routeSource = readSource("backend/routes/exports.ts");

    expect(productionProviderSource).toContain("ProductionArtifactDeliveryProvider");
    expect(productionProviderSource).toContain("not_configured");
    expect(backendMediatedSource).toContain("backend_mediated");

    expect(routeSource).toContain("decideArtifactDeliveryReadyPreconditions");
    expect(routeSource).toContain("workspaceMembershipOrRlsReady: false");
    expect(routeSource).toContain("providerConfigured: false");
    expect(routeSource).toContain("providerCanResolve: false");

    expect(readIfExists("backend/artifacts/supabaseProductionStorageProvider.ts")).toBe("");
    expect(readIfExists("backend/artifacts/s3ProductionStorageProvider.ts")).toBe("");
    expect(readIfExists("backend/artifacts/r2ProductionStorageProvider.ts")).toBe("");
  });

  test("storage strategy audit adds no signed public url browser navigation frontend storage or service-role behavior", async () => {
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
