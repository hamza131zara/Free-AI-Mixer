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

test.describe("phase173d descriptor route signed url integration audit pack", () => {
  test("descriptor route has no signed url provider wiring or signed url response behavior yet", async () => {
    const routeSource = readSource("backend/routes/exports.ts");

    expect(routeSource).toContain("delivery");

    expect(routeSource).not.toContain("createSupabaseSignedUrlDeliveryProvider");
    expect(routeSource).not.toContain("supabaseSignedUrlDeliveryProvider");
    expect(routeSource).not.toContain("SignedUrlDeliveryProvider");
    expect(routeSource).not.toContain("generateSignedUrl");
    expect(routeSource).not.toContain("backend_signed_url");
    expect(routeSource).not.toContain("signedUrl");
    expect(routeSource).not.toContain("resolveSignedUrlExpiresAt");
    expect(routeSource).not.toContain("createSignedUrl(");
    expect(routeSource).not.toContain("getPublicUrl");
    expect(routeSource).not.toContain("service_role");
    expect(routeSource).not.toContain("SERVICE_ROLE");
  });

  test("signed url provider remains backend artifact boundary only and requires later route integration phase", async () => {
    const signedUrlBoundarySource = readSource(
      "backend/artifacts/signedUrlDeliveryProvider.ts",
    );
    const supabaseSignedUrlProviderSource = readSource(
      "backend/artifacts/supabaseSignedUrlDeliveryProvider.ts",
    );
    const productionStorageSource =
      readSource("backend/artifacts/productionStorageProvider.ts") +
      "\n" +
      readSource("backend/artifacts/productionStorageProviderIntegration.ts") +
      "\n" +
      readSource("backend/artifacts/supabaseProductionStorageProvider.ts");

    expect(signedUrlBoundarySource).toContain("SignedUrlDeliveryProvider");
    expect(signedUrlBoundarySource).toContain("backend_signed_url");
    expect(signedUrlBoundarySource).toContain("MAX_SIGNED_URL_EXPIRES_IN_SECONDS");

    expect(supabaseSignedUrlProviderSource).toContain(
      "createSupabaseSignedUrlDeliveryProvider",
    );
    expect(supabaseSignedUrlProviderSource).toContain("signObjectUrl");
    expect(supabaseSignedUrlProviderSource).toContain("SignedUrlDeliveryProvider");

    expect(productionStorageSource).toContain("supabase_storage");

    expect(supabaseSignedUrlProviderSource).not.toContain("@supabase/supabase-js");
    expect(supabaseSignedUrlProviderSource).not.toContain("createClient(");
    expect(supabaseSignedUrlProviderSource).not.toContain(".storage.from(");
    expect(supabaseSignedUrlProviderSource).not.toContain("getPublicUrl");
    expect(supabaseSignedUrlProviderSource).not.toContain("service_role");
    expect(supabaseSignedUrlProviderSource).not.toContain("SERVICE_ROLE");
  });

  test("frontend still has no signed url navigation storage client or public delivery behavior", async () => {
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

    const optionalFrontendSource =
      readIfExists("src/services/supabaseClient.ts") +
      "\n" +
      readIfExists("src/lib/supabase.ts");

    const combinedFrontendSource = frontendSource + "\n" + optionalFrontendSource;

    expect(combinedFrontendSource).not.toContain("@supabase/supabase-js");
    expect(combinedFrontendSource).not.toContain("createClient(");
    expect(combinedFrontendSource).not.toContain(".storage.from(");
    expect(combinedFrontendSource).not.toContain("createSignedUrl");
    expect(combinedFrontendSource).not.toContain("getPublicUrl");
    expect(combinedFrontendSource).not.toContain("signedUrl");
    expect(combinedFrontendSource).not.toContain("backend_signed_url");
    expect(combinedFrontendSource).not.toContain("window.open");
    expect(combinedFrontendSource).not.toContain("location.href");
    expect(combinedFrontendSource).not.toContain("document.createElement");
    expect(combinedFrontendSource).not.toContain(".click()");
  });
});
