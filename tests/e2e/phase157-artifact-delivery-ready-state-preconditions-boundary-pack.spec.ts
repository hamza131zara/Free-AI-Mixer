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

test.describe("phase157 artifact delivery ready state preconditions boundary pack", () => {
  test("ready-state preconditions fail closed for authorization workspace artifact and storage blockers", async () => {
    expect(
      decideArtifactDeliveryReadyPreconditions({
        ...readyInput,
        authorization: {
          ...readyInput.authorization,
          ownerOrWorkspaceAccessAllowed: false,
        },
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "authorization_required",
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
          artifactIdMatches: false,
        },
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "artifact_id_mismatch",
    });

    expect(
      decideArtifactDeliveryReadyPreconditions({
        ...readyInput,
        artifact: {
          ...readyInput.artifact,
          status: "pending",
        },
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "artifact_not_ready",
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
          providerConfigured: false,
        },
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "storage_not_configured",
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

  test("ready-state preconditions return ready only when every condition is explicitly true", async () => {
    expect(decideArtifactDeliveryReadyPreconditions(readyInput)).toEqual({
      kind: "ready",
      deliveryMode: "backend_mediated",
    });

    expect(
      decideArtifactDeliveryReadyPreconditions({
        ...readyInput,
        artifact: {
          ...readyInput.artifact,
          status: "ready",
        },
      }),
    ).toEqual({
      kind: "ready",
      deliveryMode: "backend_mediated",
    });
  });

  test("ready-state precondition boundary is not route wired and adds no public delivery shortcuts", async () => {
    const preconditionsSource = readSource(
      "backend/artifacts/artifactDeliveryReadyPreconditions.ts",
    );
    const routeSource = readSource("backend/routes/exports.ts");

    const backendArtifactSource =
      preconditionsSource +
      "\n" +
      readSource("backend/artifacts/backendMediatedArtifactDelivery.ts") +
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
    expect(preconditionsSource).toContain("unsafe_artifact_metadata");
    expect(preconditionsSource).toContain("provider_unavailable");

    // Phase 157 is boundary-only. Route integration remains deferred.
    expect(routeSource).not.toContain("decideArtifactDeliveryReadyPreconditions");
    expect(routeSource).toContain("workspaceMembershipOrRlsReady: false");
    expect(routeSource).toContain("providerConfigured: false");
    expect(routeSource).toContain("artifactReady: false");

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
