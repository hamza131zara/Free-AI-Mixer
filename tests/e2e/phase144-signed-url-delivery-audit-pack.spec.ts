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

test.describe("phase144 signed url delivery audit pack", () => {
  test("signed url audit document defines future requirements without implementation", async () => {
    const auditSource = readSource("docs/security/phase144-signed-url-delivery-audit.md");

    expect(auditSource).toContain("Status: audit only");
    expect(auditSource).toContain("backend-only");
    expect(auditSource).toContain("Require authenticated requester context");
    expect(auditSource).toContain("Require export owner/workspace authorization");
    expect(auditSource).toContain("short-lived expiration");
    expect(auditSource).toContain("Never expose service-role secrets");
    expect(auditSource).toContain("Never expose local filesystem paths");
    expect(auditSource).toContain("createSignedUrl calls");
    expect(auditSource).toContain("getPublicUrl calls");
    expect(auditSource).toContain("Phase 145 - Backend-Mediated Artifact Delivery Pack");
  });

  test("production provider still fails closed and does not return signed url delivery", async () => {
    const provider = createProductionArtifactDeliveryNotConfiguredProvider();

    const result = await provider.resolveDelivery({
      jobId: "job-phase144",
      artifactId: "artifact-phase144",
      requester: {
        userId: "user-phase144",
        workspaceId: "workspace-phase144",
      },
    });

    expect(result).toEqual({
      kind: "unavailable",
      reason: "not_configured",
    });

    expect(isProductionArtifactDeliveryReady(result)).toBe(false);

    const providerSource = readSource("backend/artifacts/productionArtifactDeliveryProvider.ts");

    expect(providerSource).toContain("ProductionArtifactDeliveryProvider");
    expect(providerSource).toContain("createProductionArtifactDeliveryNotConfiguredProvider");
    expect(providerSource).not.toContain("signed_url");
    expect(providerSource).not.toContain("createSignedUrl");
    expect(providerSource).not.toContain("getPublicUrl");
    expect(providerSource).not.toContain("service_role");
    expect(providerSource).not.toContain("SERVICE_ROLE");
    expect(providerSource).not.toContain("filePath");
    expect(providerSource).not.toContain("localPath");
  });

  test("signed url audit does not add route frontend storage or public delivery behavior", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const appSource = readSource("backend/app.ts");

    const artifactRuntimeSource =
      readIfExists("backend/artifacts/artifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/localDevArtifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/notConfiguredArtifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/productionArtifactDeliveryProvider.ts");

    const runtimeSource = routeSource + "\n" + appSource + "\n" + artifactRuntimeSource;

    expect(routeSource).toContain("authorizationMode?: ExportRouteAuthorizationMode");
    expect(routeSource).toContain("getExportRouteAuthorizationFailure");

    expect(runtimeSource).not.toContain("createSignedUrl");
    expect(runtimeSource).not.toContain("getPublicUrl");
    expect(runtimeSource).not.toContain("service_role");
    expect(runtimeSource).not.toContain("SERVICE_ROLE");
    expect(runtimeSource).not.toContain("signed_url");
    expect(runtimeSource).not.toContain("createSupabaseStorageArtifactProvider");
    expect(runtimeSource).not.toContain("production_ready_public_delivery");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");

    const frontendSource =
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/types/exportJob.ts") +
      "\n" +
      readIfExists("src/services/exportHandleStorage.ts");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");
  });
});
