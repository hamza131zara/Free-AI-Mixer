import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { decideArtifactDeliveryReadyPreconditions } from "../../backend/artifacts/artifactDeliveryReadyPreconditions";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const readyInput = {
  authorization: {
    ownerOrWorkspaceAccessAllowed: true,
    workspaceMembershipOrRlsReady: true,
  },
  artifact: {
    metadataExists: true,
    artifactIdMatches: true,
    status: "available" as const,
    safeMetadataOnly: true,
  },
  storage: {
    providerConfigured: true,
    providerCanResolve: true,
  },
};

test.describe("phase158 descriptor route ready state integration audit pack", () => {
  test("ready-state route integration audit document defines future safe integration requirements", async () => {
    const auditSource = readSource(
      "docs/security/phase158-descriptor-route-ready-state-integration-audit.md",
    );

    expect(auditSource).toContain("Status: audit only");
    expect(auditSource).toContain("decideArtifactDeliveryReadyPreconditions");
    expect(auditSource).toContain("Descriptor route is not wired to the precondition helper yet");
    expect(auditSource).toContain("Verify artifact metadata exists on the export record");
    expect(auditSource).toContain("Verify requested artifactId matches real artifact metadata");
    expect(auditSource).toContain("Never generate signed URLs");
    expect(auditSource).toContain("Phase 159 should integrate decideArtifactDeliveryReadyPreconditions");
  });

  test("precondition helper is ready for route integration but still fails closed for missing prerequisites", async () => {
    expect(decideArtifactDeliveryReadyPreconditions(readyInput)).toEqual({
      kind: "ready",
      deliveryMode: "backend_mediated",
    });

    expect(
      decideArtifactDeliveryReadyPreconditions({
        ...readyInput,
        authorization: {
          ...readyInput.authorization,
          workspaceMembershipOrRlsReady: false,
        },
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "workspace_or_rls_not_ready",
    });

    expect(
      decideArtifactDeliveryReadyPreconditions({
        ...readyInput,
        artifact: {
          ...readyInput.artifact,
          metadataExists: false,
        },
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "artifact_metadata_missing",
    });

    expect(
      decideArtifactDeliveryReadyPreconditions({
        ...readyInput,
        artifact: {
          ...readyInput.artifact,
          safeMetadataOnly: false,
        },
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "unsafe_artifact_metadata",
    });

    expect(
      decideArtifactDeliveryReadyPreconditions({
        ...readyInput,
        storage: {
          ...readyInput.storage,
          providerCanResolve: false,
        },
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "provider_unavailable",
    });
  });

  test("descriptor route remains not integrated with ready-state helper and adds no delivery shortcuts", async () => {
    const routeSource = readSource("backend/routes/exports.ts");
    const preconditionsSource = readSource(
      "backend/artifacts/artifactDeliveryReadyPreconditions.ts",
    );
    const backendMediatedSource = readSource("backend/artifacts/backendMediatedArtifactDelivery.ts");

    const backendArtifactSource =
      preconditionsSource +
      "\n" +
      backendMediatedSource +
      "\n" +
      readIfExists("backend/artifacts/productionArtifactDeliveryProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/artifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/notConfiguredArtifactAccessProvider.ts") +
      "\n" +
      readIfExists("backend/artifacts/localDevArtifactAccessProvider.ts");

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

    expect(preconditionsSource).toContain("decideArtifactDeliveryReadyPreconditions");
    expect(preconditionsSource).toContain("artifact_metadata_missing");
    expect(preconditionsSource).toContain("provider_unavailable");

    expect(routeSource).toContain('"/exports/:jobId/artifacts/:artifactId/delivery"');
    expect(routeSource).toContain("resolveBackendMediatedArtifactDelivery");

    // Phase 158 is audit-only. Route integration exists after Phase 159, but remains unavailable-by-default.
    expect(routeSource).toContain("decideArtifactDeliveryReadyPreconditions");
    expect(routeSource).toContain("workspaceMembershipOrRlsReady: false");
    expect(routeSource).toContain("providerConfigured: false");
    expect(routeSource).toContain("providerCanResolve: false");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("createSignedUrl");
    expect(routeSource).not.toContain("getPublicUrl");
    expect(routeSource).not.toContain("service_role");
    expect(routeSource).not.toContain("SERVICE_ROLE");

    expect(backendArtifactSource).not.toContain("createSignedUrl");
    expect(backendArtifactSource).not.toContain("getPublicUrl");
    expect(backendArtifactSource).not.toContain("service_role");
    expect(backendArtifactSource).not.toContain("SERVICE_ROLE");
    expect(backendArtifactSource).not.toContain("production_ready_public_delivery");

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

