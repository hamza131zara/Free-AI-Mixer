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

test.describe("phase146 frontend download ui audit pack", () => {
  test("frontend download ui audit document exists without enabling implementation", async () => {
    const auditSource = readSource("docs/security/phase146-frontend-download-ui-audit.md");

    expect(auditSource).toContain("Status: audit only");
    expect(auditSource).toContain("backend-mediated artifact descriptors");
    expect(auditSource).toContain("Never construct storage URLs in React components");
    expect(auditSource).toContain("Never call Supabase storage from frontend");
    expect(auditSource).toContain("Download button");
    expect(auditSource).toContain("window.open");
    expect(auditSource).toContain("location.href");
    expect(auditSource).toContain("Phase 147");
  });

  test("frontend still has artifact access boundary but no download navigation behavior", async () => {
    const frontendSource =
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/components/TimelineExportPanel.tsx") +
      "\n" +
      readIfExists("src/types/exportJob.ts") +
      "\n" +
      readIfExists("src/services/exportHandleStorage.ts");

    expect(frontendSource).toContain("requestExportArtifactAccess");
    expect(frontendSource).toContain("getExportArtifactAccess");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");
    expect(frontendSource).not.toContain(".click()");
    expect(frontendSource).not.toContain("document.createElement(\"a\")");
    expect(frontendSource).not.toContain("document.createElement('a')");
  });

  test("backend delivery boundaries remain not frontend-wired and public delivery stays blocked", async () => {
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

    const frontendSource =
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/components/TimelineExportPanel.tsx");

    expect(artifactSource).toContain("resolveBackendMediatedArtifactDelivery");
    expect(artifactSource).toContain("createProductionArtifactDeliveryNotConfiguredProvider");

    expect(routeSource).not.toContain("resolveBackendMediatedArtifactDelivery");
    expect(routeSource).not.toContain("createProductionArtifactDeliveryNotConfiguredProvider");

    expect(frontendSource).not.toContain("resolveBackendMediatedArtifactDelivery");
    expect(frontendSource).not.toContain("createProductionArtifactDeliveryNotConfiguredProvider");
    expect(frontendSource).not.toContain("production_ready_public_delivery");

    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("getPublicUrl");
    expect(artifactSource).not.toContain("service_role");
    expect(artifactSource).not.toContain("SERVICE_ROLE");
    expect(artifactSource).not.toContain("production_ready_public_delivery");
  });
});
