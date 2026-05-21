import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createProductionArtifactDeliveryNotConfiguredProvider,
  isProductionArtifactDeliveryReady,
} from "../../backend/artifacts/productionArtifactDeliveryProvider";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase143 production artifact provider boundary pack", () => {
  test("not-configured production artifact provider fails closed without fake delivery", async () => {
    const provider = createProductionArtifactDeliveryNotConfiguredProvider();

    const result = await provider.resolveDelivery({
      jobId: "job-phase143",
      artifactId: "artifact-phase143",
      requester: {
        userId: "user-phase143",
        workspaceId: "workspace-phase143",
      },
    });

    expect(result).toEqual({
      kind: "unavailable",
      reason: "not_configured",
    });

    expect(isProductionArtifactDeliveryReady(result)).toBe(false);
  });

  test("production artifact provider boundary exists but is not wired into routes or app runtime", async () => {
    const providerSource = readSource("backend/artifacts/productionArtifactDeliveryProvider.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const appSource = readSource("backend/app.ts");

    expect(providerSource).toContain("ProductionArtifactDeliveryProvider");
    expect(providerSource).toContain("createProductionArtifactDeliveryNotConfiguredProvider");
    expect(providerSource).toContain("isProductionArtifactDeliveryReady");
    expect(providerSource).toContain('deliveryMode: "backend_mediated"');
    expect(providerSource).toContain('reason: "not_configured"');

    expect(routeSource).not.toContain("createProductionArtifactDeliveryNotConfiguredProvider");
    expect(routeSource).not.toContain("ProductionArtifactDeliveryProvider");
    expect(routeSource).not.toContain("isProductionArtifactDeliveryReady");
    expect(appSource).not.toContain("createProductionArtifactDeliveryNotConfiguredProvider");
    expect(appSource).not.toContain("ProductionArtifactDeliveryProvider");
    expect(appSource).not.toContain("isProductionArtifactDeliveryReady");

    expect(routeSource).toContain("authorizationMode?: ExportRouteAuthorizationMode");
    expect(routeSource).toContain("getExportRouteAuthorizationFailure");
  });

  test("production artifact provider boundary does not add active public delivery behavior", async () => {
    const providerSource = readSource("backend/artifacts/productionArtifactDeliveryProvider.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    const frontendSource =
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/types/exportJob.ts") +
      "\n" +
      readIfExists("src/services/exportHandleStorage.ts");

    const artifactRuntimeSource =
      readIfExists("backend/artifacts/artifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/localDevArtifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/notConfiguredArtifactAccessProvider.ts");

    expect(providerSource).not.toContain("createSignedUrl");
    expect(providerSource).not.toContain("getPublicUrl");
    expect(providerSource).not.toContain("service_role");
    expect(providerSource).not.toContain("SERVICE_ROLE");
    expect(providerSource).not.toContain("filePath");
    expect(providerSource).not.toContain("localPath");
    expect(providerSource).not.toContain("filesystemPath");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("createProductionArtifactDeliveryProvider");
    expect(routeSource).not.toContain("createSignedUrl");
    expect(routeSource).not.toContain("getPublicUrl");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");

    expect(artifactRuntimeSource).not.toContain("production_ready_public_delivery");
    expect(artifactRuntimeSource).not.toContain("createSignedUrl");
    expect(artifactRuntimeSource).not.toContain("getPublicUrl");
  });
});
