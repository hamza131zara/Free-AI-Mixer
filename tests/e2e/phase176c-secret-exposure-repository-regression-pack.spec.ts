import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  scanForSecretExposure,
} from "../../backend/security/secretExposureGuard";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const expectSafe = (
  label: string,
  content: string,
  context: "frontend_source" | "backend_source" | "docs_source",
): void => {
  const result = scanForSecretExposure({
    content,
    context,
  });

  expect(result, label).toEqual({
    kind: "safe",
    findings: [],
    safeToExpose: true,
  });
};

test.describe("phase176c secret exposure repository regression pack", () => {
  test("frontend delivery and navigation source remains free of secret exposure markers", async () => {
    const frontendSource =
      readSource("src/services/artifactDeliveryDescriptorService.ts") +
      "\n" +
      readSource("src/store/artifactDeliveryDescriptorStore.ts") +
      "\n" +
      readSource("src/services/artifactDownloadNavigationStrategy.ts") +
      "\n" +
      readSource("src/services/artifactDownloadUiState.ts") +
      "\n" +
      readSource("src/components/ArtifactDeliveryDescriptorAction.tsx") +
      "\n" +
      readSource("src/components/ArtifactDownloadAction.tsx") +
      "\n" +
      readIfExists("src/services/supabaseClient.ts") +
      "\n" +
      readIfExists("src/lib/supabase.ts");

    expectSafe("frontend artifact delivery/download source", frontendSource, "frontend_source");

    expect(frontendSource).toContain("backend_signed_url");
    expect(frontendSource).toContain("navigateToArtifactDownloadDescriptor");
    expect(frontendSource).toContain("targetWindow.open");
    expect(frontendSource).not.toContain("location.href");
    expect(frontendSource).not.toContain("document.createElement");
    expect(frontendSource).not.toContain(".click()");
  });

  test("backend artifact auth and readiness source remains free of secret exposure markers", async () => {
    const backendSource =
      readSource("backend/artifacts/signedUrlDeliveryProvider.ts") +
      "\n" +
      readSource("backend/artifacts/supabaseSignedUrlDeliveryProvider.ts") +
      "\n" +
      readSource("backend/artifacts/supabaseProductionStorageProvider.ts") +
      "\n" +
      readSource("backend/auth/productionJwtAuthReadiness.ts") +
      "\n" +
      readSource("backend/auth/productionRlsReadiness.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthMiddleware.ts") +
      "\n" +
      readSource("backend/routes/exports.ts");

    expectSafe("backend artifact/auth/readiness source", backendSource, "backend_source");

    expect(backendSource).toContain("signedUrlDeliveryProvider");
    expect(backendSource).toContain("createSupabaseSignedUrlDeliveryProvider");
    expect(backendSource).toContain("createSupabaseProductionStorageProvider");
    expect(backendSource).toContain("routeRuntimeEnabled: false");
    expect(backendSource).toContain("publicLaunchEnabled: false");
  });

  test("security docs and known issues keep launch blocked without secret or public url enablement", async () => {
    const docsSource =
      readSource("docs/phases.md") +
      "\n" +
      readSource("docs/known-issues.md") +
      "\n" +
      readIfExists("docs/security/phase140-supabase-rls-policy-draft.sql") +
      "\n" +
      readIfExists("docs/security/phase173a-signed-url-delivery-safety-audit.md");

    expect(docsSource).toContain("Public launch remains blocked");
    expect(docsSource).toContain("service-role");
    expect(docsSource).toContain("no frontend Supabase/storage access");

    expect(docsSource).not.toContain("PUBLIC_LAUNCH_ENABLED=true");
    expect(docsSource).not.toContain("production_ready_public_delivery");
    expect(docsSource).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE=");
    expect(docsSource).not.toContain("VITE_SUPABASE_SERVICE_ROLE=");
    expect(docsSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY=");
    expect(docsSource).not.toContain("-----BEGIN PRIVATE KEY-----");
  });
});
