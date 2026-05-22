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

test.describe("phase174a frontend download navigation audit pack", () => {
  test("frontend download navigation remains blocked before implementation phase", async () => {
    const navigationSource = readSource("src/services/artifactDownloadNavigationStrategy.ts");
    const actionSource = readSource("src/components/ArtifactDownloadAction.tsx");
    const descriptorActionSource = readSource("src/components/ArtifactDeliveryDescriptorAction.tsx");
    const panelSource = readSource("src/components/TimelineExportPanel.tsx");

    const combinedFrontendSource =
      navigationSource +
      "\n" +
      actionSource +
      "\n" +
      descriptorActionSource +
      "\n" +
      panelSource;

    expect(combinedFrontendSource).not.toContain("window.open");
    expect(combinedFrontendSource).not.toContain("location.href");
    expect(combinedFrontendSource).not.toContain("document.createElement");
    expect(combinedFrontendSource).not.toContain(".click()");
    expect(combinedFrontendSource).not.toContain("backend_signed_url");
    expect(combinedFrontendSource).not.toContain("signedUrl");
  });

  test("frontend still has no direct supabase storage or public url behavior", async () => {
    const frontendSource =
      readSource("src/services/artifactDownloadNavigationStrategy.ts") +
      "\n" +
      readSource("src/services/artifactDeliveryDescriptorService.ts") +
      "\n" +
      readSource("src/store/artifactDeliveryDescriptorStore.ts") +
      "\n" +
      readSource("src/components/ArtifactDeliveryDescriptorAction.tsx") +
      "\n" +
      readIfExists("src/services/supabaseClient.ts") +
      "\n" +
      readIfExists("src/lib/supabase.ts");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain("SERVICE_ROLE");
  });

  test("backend signed url descriptor exists but frontend navigation implementation is deferred", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const descriptorServiceSource = readSource("src/services/artifactDeliveryDescriptorService.ts");

    expect(routeSource).toContain("signedUrlDeliveryProvider");
    expect(routeSource).toContain("generateSignedUrl");
    expect(routeSource).toContain("signedUrlResult.signedUrl");
    expect(routeSource).toContain("artifact_delivery_ready");

    expect(descriptorServiceSource).toContain("artifact_delivery_ready");
    expect(descriptorServiceSource).not.toContain("window.open");
    expect(descriptorServiceSource).not.toContain("location.href");
    expect(descriptorServiceSource).not.toContain("document.createElement");
    expect(descriptorServiceSource).not.toContain(".click()");
  });
});
