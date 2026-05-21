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

test.describe("phase142 production artifact delivery strategy audit pack", () => {
  test("production artifact delivery strategy exists as audit documentation only", async () => {
    const strategySource = readSource(
      "docs/security/phase142-production-artifact-delivery-strategy.md",
    );

    expect(strategySource).toContain("Status: draft/audit only");
    expect(strategySource).toContain("Backend verifies authenticated requester context");
    expect(strategySource).toContain("Backend verifies export owner/workspace access");
    expect(strategySource).toContain("workspace membership");
    expect(strategySource).toContain("RLS");
    expect(strategySource).toContain("Frontend never directly creates Supabase clients or storage URLs");
    expect(strategySource).toContain("Phase 143 - Production Artifact Provider Boundary Pack");
  });

  test("production artifact delivery is not implemented or wired into runtime yet", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const appSource = readSource("backend/app.ts");
    const artifactAccessProviderSource = readIfExists("backend/artifacts/artifactAccessProvider.ts");
    const localDevProviderSource = readIfExists("backend/artifacts/localDevArtifactAccessProvider.ts");
    const notConfiguredProviderSource = readIfExists("backend/artifacts/notConfiguredArtifactAccessProvider.ts");

    const runtimeSource =
      routeSource +
      "\n" +
      appSource +
      "\n" +
      artifactAccessProviderSource +
      "\n" +
      localDevProviderSource +
      "\n" +
      notConfiguredProviderSource;

    expect(routeSource).toContain("authorizationMode?: ExportRouteAuthorizationMode");
    expect(routeSource).toContain("getExportRouteAuthorizationFailure");

    expect(runtimeSource).not.toContain("createSignedUrl");
    expect(runtimeSource).not.toContain("getPublicUrl");
    expect(runtimeSource).not.toContain("service_role");
    expect(runtimeSource).not.toContain("SERVICE_ROLE");
    expect(runtimeSource).not.toContain("productionArtifactDeliveryProvider");
    expect(runtimeSource).not.toContain("createProductionArtifactDeliveryProvider");
    expect(runtimeSource).not.toContain("publicArtifactUrl");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
  });

  test("frontend storage access and public artifact delivery remain blocked", async () => {
    const frontendSource =
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/types/exportJob.ts") +
      "\n" +
      readIfExists("src/services/exportHandleStorage.ts");

    const artifactSource =
      readIfExists("backend/artifacts/artifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/localDevArtifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/notConfiguredArtifactAccessProvider.ts");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");

    expect(artifactSource).not.toContain("production_ready_public_delivery");
    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("getPublicUrl");
  });
});

