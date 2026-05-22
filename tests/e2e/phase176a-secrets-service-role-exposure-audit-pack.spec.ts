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

test.describe("phase176a secrets service role exposure audit pack", () => {
  test("frontend has no service role supabase storage or public url behavior", async () => {
    const frontendSource =
      readSource("src/services/artifactDeliveryDescriptorService.ts") +
      "\n" +
      readSource("src/store/artifactDeliveryDescriptorStore.ts") +
      "\n" +
      readSource("src/services/artifactDownloadNavigationStrategy.ts") +
      "\n" +
      readSource("src/components/ArtifactDeliveryDescriptorAction.tsx") +
      "\n" +
      readSource("src/components/ArtifactDownloadAction.tsx") +
      "\n" +
      readIfExists("src/services/supabaseClient.ts") +
      "\n" +
      readIfExists("src/lib/supabase.ts");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("SERVICE_ROLE");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(frontendSource).not.toContain("VITE_SUPABASE_SERVICE_ROLE");
    expect(frontendSource).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("createSignedUrl");
  });

  test("backend signed url and storage providers keep secrets backend scoped and avoid public urls", async () => {
    const backendArtifactSource =
      readSource("backend/artifacts/signedUrlDeliveryProvider.ts") +
      "\n" +
      readSource("backend/artifacts/supabaseSignedUrlDeliveryProvider.ts") +
      "\n" +
      readSource("backend/artifacts/supabaseProductionStorageProvider.ts") +
      "\n" +
      readSource("backend/artifacts/productionStorageProvider.ts") +
      "\n" +
      readSource("backend/artifacts/productionStorageProviderIntegration.ts");

    const routeSource = readSource("backend/routes/exports.ts");

    expect(backendArtifactSource).toContain("createSupabaseSignedUrlDeliveryProvider");
    expect(backendArtifactSource).toContain("createSupabaseProductionStorageProvider");
    expect(backendArtifactSource).toContain("signObjectUrl");
    expect(backendArtifactSource).toContain("verifyObject");

    expect(backendArtifactSource + routeSource).not.toContain("getPublicUrl");
    expect(backendArtifactSource + routeSource).not.toContain("publicUrl");
    expect(backendArtifactSource + routeSource).not.toContain("production_ready_public_delivery");
    expect(backendArtifactSource + routeSource).not.toContain("console.log");
    expect(backendArtifactSource + routeSource).not.toContain("console.error");
    expect(backendArtifactSource + routeSource).not.toContain("SERVICE_ROLE");
    expect(backendArtifactSource + routeSource).not.toContain("service_role");
  });

  test("repository auth and readiness boundaries do not expose secrets or enable public launch", async () => {
    const backendSource =
      readSource("backend/auth/productionJwtAuthReadiness.ts") +
      "\n" +
      readSource("backend/auth/productionRlsReadiness.ts") +
      "\n" +
      readSource("backend/auth/trustedAuthMiddleware.ts") +
      "\n" +
      readSource("backend/auth/jwtProviderVerificationStrategy.ts") +
      "\n" +
      readSource("backend/auth/supabaseRlsVerification.ts") +
      "\n" +
      readIfExists("backend/composition/backendDependencies.ts") +
      "\n" +
      readIfExists("backend/repositories/repositoryComposition.ts");

    expect(backendSource).toContain("routeRuntimeEnabled: false");
    expect(backendSource).toContain("realVerificationEnabled: false");
    expect(backendSource).toContain("publicLaunchEnabled: false");
    expect(backendSource).toContain("migrationsApplied: false");

    expect(backendSource).not.toContain('req.headers["x-user-id"]');
    expect(backendSource).not.toContain('req.headers["x-workspace-id"]');
    expect(backendSource).not.toContain("fakeSession");
    expect(backendSource).not.toContain("mockAuthenticatedUser");
    expect(backendSource).not.toContain("SERVICE_ROLE");
    expect(backendSource).not.toContain("service_role");
    expect(backendSource).not.toContain("PUBLIC_LAUNCH_ENABLED");
  });
});
