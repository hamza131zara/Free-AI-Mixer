import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  resolveBackendMediatedArtifactDelivery,
} from "../../backend/artifacts/backendMediatedArtifactDelivery";
import {
  createProductionArtifactDeliveryNotConfiguredProvider,
} from "../../backend/artifacts/productionArtifactDeliveryProvider";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase148 backend artifact delivery descriptor route wiring audit pack", () => {
  test("descriptor route wiring audit document defines future safe route requirements", async () => {
    const auditSource = readSource(
      "docs/security/phase148-backend-artifact-delivery-descriptor-route-wiring-audit.md",
    );

    expect(auditSource).toContain("Status: audit only");
    expect(auditSource).toContain("Require trusted authenticated requester context");
    expect(auditSource).toContain("Use export route authorization guards");
    expect(auditSource).toContain("Verify workspace membership or RLS readiness");
    expect(auditSource).toContain("Verify artifact metadata exists and is ready");
    expect(auditSource).toContain("Never expose local filesystem paths");
    expect(auditSource).toContain("Never fabricate ready delivery");
    expect(auditSource).toContain("Phase 149");
  });

  test("backend delivery boundaries exist but descriptor route wiring remains deferred", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const backendMediatedSource = readSource(
      "backend/artifacts/backendMediatedArtifactDelivery.ts",
    );
    const productionProviderSource = readSource(
      "backend/artifacts/productionArtifactDeliveryProvider.ts",
    );

    const readyDescriptor = resolveBackendMediatedArtifactDelivery(
      {
        jobId: "job-phase148",
        artifactId: "artifact-phase148",
        requester: {
          userId: "user-phase148",
          workspaceId: "workspace-phase148",
        },
        authorization: {
          ownerOrWorkspaceAccessAllowed: true,
          workspaceMembershipOrRlsReady: true,
        },
        storage: {
          providerConfigured: true,
          artifactReady: true,
        },
      },
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect(readyDescriptor).toEqual({
      kind: "ready",
      deliveryMode: "backend_mediated",
      jobId: "job-phase148",
      artifactId: "artifact-phase148",
      backendRoutePath: "/exports/job-phase148/artifacts/artifact-phase148/stream",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });

    const provider = createProductionArtifactDeliveryNotConfiguredProvider();
    await expect(
      provider.resolveDelivery({
        jobId: "job-phase148",
        artifactId: "artifact-phase148",
        requester: {
          userId: "user-phase148",
          workspaceId: "workspace-phase148",
        },
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "not_configured",
    });

    expect(backendMediatedSource).toContain("resolveBackendMediatedArtifactDelivery");
    expect(productionProviderSource).toContain("createProductionArtifactDeliveryNotConfiguredProvider");

    // Phase 148 is audit-only. Route wiring remains deferred.
    expect(routeSource).not.toContain("resolveBackendMediatedArtifactDelivery");
    expect(routeSource).not.toContain("createProductionArtifactDeliveryNotConfiguredProvider");
    expect(routeSource).not.toContain("ProductionArtifactDeliveryProvider");
    expect(routeSource).not.toContain("backendRoutePath");
    expect(routeSource).not.toContain('deliveryMode: "backend_mediated"');

    expect(routeSource).toContain("authorizationMode?: ExportRouteAuthorizationMode");
    expect(routeSource).toContain("getExportRouteAuthorizationFailure");
  });

  test("descriptor route audit does not add frontend navigation storage signed urls or public delivery", async () => {
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
      readIfExists("src/components/ArtifactDownloadAction.tsx") +
      "\n" +
      readIfExists("src/services/artifactDownloadUiState.ts") +
      "\n" +
      readIfExists("src/components/TimelineExportPanel.tsx") +
      "\n" +
      readIfExists("src/types/exportJob.ts") +
      "\n" +
      readIfExists("src/services/exportHandleStorage.ts");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");

    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("getPublicUrl");
    expect(artifactSource).not.toContain("service_role");
    expect(artifactSource).not.toContain("SERVICE_ROLE");
    expect(artifactSource).not.toContain("production_ready_public_delivery");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");
    expect(frontendSource).not.toContain("document.createElement");
    expect(frontendSource).not.toContain(".click()");
  });
});
