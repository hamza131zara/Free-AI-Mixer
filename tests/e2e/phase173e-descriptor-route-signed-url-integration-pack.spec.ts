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

test.describe("phase173e descriptor route signed url integration pack", () => {
  test("descriptor route wires signed url provider only behind ready preconditions", async () => {
    const routeSource = readSource("backend/routes/exports.ts");

    expect(routeSource).toContain("SignedUrlDeliveryProvider");
    expect(routeSource).toContain("createSignedUrlDeliveryNotConfiguredProvider");
    expect(routeSource).toContain("signedUrlDeliveryProvider");
    expect(routeSource).toContain("generateSignedUrl");
    expect(routeSource).toContain("isSignedUrlDeliveryReady");
    expect(routeSource).toContain("signedUrlResult.deliveryMode");
    expect(routeSource).toContain("signedUrl");

    expect(routeSource).toContain("decideArtifactDeliveryReadyPreconditions");
    expect(routeSource).toContain('readyPreconditionsDecision.kind !== "ready"');
    expect(routeSource).toContain("resolveProductionStorageReadiness");
    expect(routeSource).toContain("productionStorageReadiness.providerConfigured");
    expect(routeSource).toContain("productionStorageReadiness.providerCanResolve");

    expect(routeSource.indexOf('readyPreconditionsDecision.kind !== "ready"')).toBeLessThan(
      routeSource.indexOf("generateSignedUrl"),
    );

    expect(routeSource).not.toContain("createSupabaseSignedUrlDeliveryProvider");
    expect(routeSource).not.toContain("@supabase/supabase-js");
    expect(routeSource).not.toContain("createClient(");
    expect(routeSource).not.toContain(".storage.from(");
    expect(routeSource).not.toContain("getPublicUrl");
    expect(routeSource).not.toContain("service_role");
    expect(routeSource).not.toContain("SERVICE_ROLE");
  });

  test("descriptor route keeps unauthorized unavailable and unsafe states before signed url generation", async () => {
    const routeSource = readSource("backend/routes/exports.ts");

    expect(routeSource).toContain("getExportRouteAuthorizationFailure");
    expect(routeSource).toContain("sendExportRouteAuthorizationFailure");
    expect(routeSource).toContain("workspaceMembershipOrRlsReady: false");
    expect(routeSource).toContain("safeMetadataOnly: isSafeArtifactDeliveryMetadata");
    expect(routeSource).toContain("getProductionStorageRefFromArtifactMetadata");
    expect(routeSource).toContain("artifact_delivery_unavailable");
    expect(routeSource).toContain("storage_not_configured");

    expect(routeSource.indexOf("getExportRouteAuthorizationFailure")).toBeLessThan(
      routeSource.indexOf("generateSignedUrl"),
    );
    expect(routeSource.indexOf("resolveProductionStorageReadiness")).toBeLessThan(
      routeSource.indexOf("generateSignedUrl"),
    );

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("production_ready_public_delivery");
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



