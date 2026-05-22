import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolveBackendMediatedArtifactDelivery } from "../../backend/artifacts/backendMediatedArtifactDelivery";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const baseRequest = {
  jobId: "job-phase156",
  artifactId: "artifact-phase156",
  requester: {
    userId: "user-phase156",
    workspaceId: "workspace-phase156",
  },
};

test.describe("phase156 artifact delivery ready state backend preconditions audit pack", () => {
  test("ready-state audit document defines required backend preconditions without enabling delivery", async () => {
    const auditSource = readSource(
      "docs/security/phase156-artifact-delivery-ready-state-backend-preconditions-audit.md",
    );

    expect(auditSource).toContain("Status: audit only");
    expect(auditSource).toContain("Trusted requester context exists");
    expect(auditSource).toContain("Route authorization allows requester access");
    expect(auditSource).toContain("Workspace membership or RLS readiness is verified");
    expect(auditSource).toContain("Artifact metadata exists on the export job");
    expect(auditSource).toContain("Storage/provider is configured");
    expect(auditSource).toContain("No signed URL generation exists");
    expect(auditSource).toContain("Phase 157 should add a pure backend precondition helper only");
  });

  test("backend mediated delivery helper only returns ready when every precondition is explicitly true", async () => {
    expect(
      resolveBackendMediatedArtifactDelivery({
        ...baseRequest,
        authorization: {
          ownerOrWorkspaceAccessAllowed: false,
          workspaceMembershipOrRlsReady: false,
        },
        storage: {
          providerConfigured: false,
          artifactReady: false,
        },
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "authorization_required",
    });

    expect(
      resolveBackendMediatedArtifactDelivery({
        ...baseRequest,
        authorization: {
          ownerOrWorkspaceAccessAllowed: true,
          workspaceMembershipOrRlsReady: false,
        },
        storage: {
          providerConfigured: true,
          artifactReady: true,
        },
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "workspace_or_rls_not_ready",
    });

    expect(
      resolveBackendMediatedArtifactDelivery({
        ...baseRequest,
        authorization: {
          ownerOrWorkspaceAccessAllowed: true,
          workspaceMembershipOrRlsReady: true,
        },
        storage: {
          providerConfigured: false,
          artifactReady: true,
        },
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "storage_not_configured",
    });

    expect(
      resolveBackendMediatedArtifactDelivery({
        ...baseRequest,
        authorization: {
          ownerOrWorkspaceAccessAllowed: true,
          workspaceMembershipOrRlsReady: true,
        },
        storage: {
          providerConfigured: true,
          artifactReady: false,
        },
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "artifact_not_ready",
    });

    expect(
      resolveBackendMediatedArtifactDelivery(
        {
          ...baseRequest,
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
      ),
    ).toEqual({
      kind: "ready",
      deliveryMode: "backend_mediated",
      jobId: "job-phase156",
      artifactId: "artifact-phase156",
      backendRoutePath: "/exports/job-phase156/artifacts/artifact-phase156/stream",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });
  });

  test("descriptor route remains blocked from ready state by default and adds no public delivery shortcuts", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const backendMediatedSource = readSource("backend/artifacts/backendMediatedArtifactDelivery.ts");

    const frontendSource =
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

    expect(routeSource).toContain('"/exports/:jobId/artifacts/:artifactId/delivery"');
    expect(routeSource).toContain("resolveBackendMediatedArtifactDelivery");
    expect(routeSource).toContain("workspaceMembershipOrRlsReady: false");
    expect(routeSource).toContain("providerConfigured: false");
    expect(routeSource).toContain("artifactReady: false");

    expect(backendMediatedSource).toContain("authorization_required");
    expect(backendMediatedSource).toContain("workspace_or_rls_not_ready");
    expect(backendMediatedSource).toContain("storage_not_configured");
    expect(backendMediatedSource).toContain("artifact_not_ready");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("createSignedUrl");
    expect(routeSource).not.toContain("getPublicUrl");
    expect(routeSource).not.toContain("service_role");
    expect(routeSource).not.toContain("SERVICE_ROLE");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");
    expect(frontendSource).not.toContain("document.createElement");
    expect(frontendSource).not.toContain(".click()");

    expect(artifactSource).not.toContain("createSignedUrl");
    expect(artifactSource).not.toContain("getPublicUrl");
    expect(artifactSource).not.toContain("service_role");
    expect(artifactSource).not.toContain("SERVICE_ROLE");
    expect(artifactSource).not.toContain("production_ready_public_delivery");
  });
});
