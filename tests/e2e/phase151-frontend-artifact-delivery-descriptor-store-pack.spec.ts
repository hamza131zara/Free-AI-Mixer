import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  buildArtifactDeliveryDescriptorStoreKey,
  useArtifactDeliveryDescriptorStore,
} from "../../src/store/artifactDeliveryDescriptorStore";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase151 frontend artifact delivery descriptor store pack", () => {
  test.beforeEach(() => {
    useArtifactDeliveryDescriptorStore.getState().resetArtifactDeliveryDescriptors();
  });

  test("descriptor store tracks loading unavailable ready and clear states", async () => {
    expect(buildArtifactDeliveryDescriptorStoreKey("job-phase151", "artifact-phase151")).toBe(
      "job-phase151::artifact-phase151",
    );

    expect(
      useArtifactDeliveryDescriptorStore
        .getState()
        .getDescriptorState("job-phase151", "artifact-phase151"),
    ).toEqual({
      kind: "idle",
    });

    let resolveFetch: ((response: Response) => void) | undefined;

    const pendingRequest = useArtifactDeliveryDescriptorStore
      .getState()
      .requestArtifactDeliveryDescriptor("job-phase151", "artifact-phase151", {
        fetchFn: async () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      });

    expect(
      useArtifactDeliveryDescriptorStore
        .getState()
        .getDescriptorState("job-phase151", "artifact-phase151"),
    ).toEqual({
      kind: "loading",
      jobId: "job-phase151",
      artifactId: "artifact-phase151",
    });

    resolveFetch?.(
      new Response(
        JSON.stringify({
          kind: "artifact_delivery_unavailable",
          reason: "workspace_or_rls_not_ready",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    await expect(pendingRequest).resolves.toEqual({
      kind: "unavailable",
      jobId: "job-phase151",
      artifactId: "artifact-phase151",
      reason: "workspace_or_rls_not_ready",
    });

    expect(
      useArtifactDeliveryDescriptorStore
        .getState()
        .getDescriptorState("job-phase151", "artifact-phase151"),
    ).toEqual({
      kind: "unavailable",
      jobId: "job-phase151",
      artifactId: "artifact-phase151",
      reason: "workspace_or_rls_not_ready",
    });

    useArtifactDeliveryDescriptorStore
      .getState()
      .clearArtifactDeliveryDescriptor("job-phase151", "artifact-phase151");

    expect(
      useArtifactDeliveryDescriptorStore
        .getState()
        .getDescriptorState("job-phase151", "artifact-phase151"),
    ).toEqual({
      kind: "idle",
    });
  });

  test("descriptor store maps ready descriptors and safe route errors without navigation", async () => {
    await expect(
      useArtifactDeliveryDescriptorStore
        .getState()
        .requestArtifactDeliveryDescriptor("job-phase151", "artifact-phase151", {
          fetchFn: async () =>
            new Response(
              JSON.stringify({
                kind: "artifact_delivery_ready",
                deliveryMode: "backend_mediated",
                jobId: "job-phase151",
                artifactId: "artifact-phase151",
                backendRoutePath: "/exports/job-phase151/artifacts/artifact-phase151/stream",
                expiresAt: "2026-01-01T00:05:00.000Z",
              }),
              {
                status: 200,
                headers: {
                  "content-type": "application/json",
                },
              },
            ),
        }),
    ).resolves.toEqual({
      kind: "ready",
      deliveryMode: "backend_mediated",
      jobId: "job-phase151",
      artifactId: "artifact-phase151",
      backendRoutePath: "/exports/job-phase151/artifacts/artifact-phase151/stream",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });

    await expect(
      useArtifactDeliveryDescriptorStore
        .getState()
        .requestArtifactDeliveryDescriptor("job-phase151", "artifact-phase151", {
          fetchFn: async () => new Response("{}", { status: 403 }),
        }),
    ).resolves.toEqual({
      kind: "error",
      jobId: "job-phase151",
      artifactId: "artifact-phase151",
      reason: "forbidden",
      status: 403,
    });
  });

  test("descriptor store is not UI wired and does not add download navigation storage signed url or public delivery behavior", async () => {
    const descriptorStoreSource = readSource("src/store/artifactDeliveryDescriptorStore.ts");
    const exportStoreSource = readSource("src/store/exportStore.ts");
    const descriptorServiceSource = readSource("src/services/artifactDeliveryDescriptorService.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    const frontendSource =
      descriptorStoreSource +
      "\n" +
      exportStoreSource +
      "\n" +
      descriptorServiceSource +
      "\n" +
      readSource("src/services/exportService.ts") +
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

    expect(descriptorStoreSource).toContain("useArtifactDeliveryDescriptorStore");
    expect(descriptorStoreSource).toContain("requestArtifactDeliveryDescriptor");
    expect(descriptorStoreSource).toContain("getArtifactDeliveryDescriptor");

    expect(routeSource).toContain('"/exports/:jobId/artifacts/:artifactId/delivery"');
    expect(routeSource).toContain("resolveBackendMediatedArtifactDelivery");

    // Phase 151 adds a dedicated store boundary. Main exportStore/UI wiring remains deferred.
    expect(exportStoreSource).not.toContain("getArtifactDeliveryDescriptor");
    expect(exportStoreSource).not.toContain("useArtifactDeliveryDescriptorStore");

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
