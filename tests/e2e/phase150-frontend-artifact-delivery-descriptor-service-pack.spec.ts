import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  buildArtifactDeliveryDescriptorPath,
  getArtifactDeliveryDescriptor,
  parseArtifactDeliveryDescriptorPayload,
} from "../../src/services/artifactDeliveryDescriptorService";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase150 frontend artifact delivery descriptor service pack", () => {
  test("descriptor service builds route path and parses unavailable ready and invalid payloads", async () => {
    expect(
      buildArtifactDeliveryDescriptorPath("job phase150", "artifact/phase150"),
    ).toBe("/exports/job%20phase150/artifacts/artifact%2Fphase150/delivery");

    expect(
      parseArtifactDeliveryDescriptorPayload({
        kind: "artifact_delivery_unavailable",
        reason: "workspace_or_rls_not_ready",
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "workspace_or_rls_not_ready",
    });

    expect(
      parseArtifactDeliveryDescriptorPayload({
        kind: "artifact_delivery_ready",
        deliveryMode: "backend_mediated",
        jobId: "job-phase150",
        artifactId: "artifact-phase150",
        backendRoutePath: "/exports/job-phase150/artifacts/artifact-phase150/stream",
        expiresAt: "2026-01-01T00:05:00.000Z",
      }),
    ).toEqual({
      kind: "ready",
      deliveryMode: "backend_mediated",
      jobId: "job-phase150",
      artifactId: "artifact-phase150",
      backendRoutePath: "/exports/job-phase150/artifacts/artifact-phase150/stream",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });

    expect(parseArtifactDeliveryDescriptorPayload({ kind: "unknown" })).toEqual({
      kind: "error",
      reason: "invalid_response",
    });
  });

  test("descriptor service uses injected fetch and maps safe route errors", async () => {
    const calls: string[] = [];

    const unavailable = await getArtifactDeliveryDescriptor("job-phase150", "artifact-phase150", {
      baseUrl: "http://127.0.0.1:8787",
      fetchFn: async (input) => {
        calls.push(String(input));

        return new Response(
          JSON.stringify({
            kind: "artifact_delivery_unavailable",
            reason: "storage_not_configured",
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      },
    });

    expect(calls).toEqual([
      "http://127.0.0.1:8787/exports/job-phase150/artifacts/artifact-phase150/delivery",
    ]);

    expect(unavailable).toEqual({
      kind: "unavailable",
      reason: "storage_not_configured",
    });

    await expect(
      getArtifactDeliveryDescriptor("job-phase150", "artifact-phase150", {
        fetchFn: async () => new Response("{}", { status: 401 }),
      }),
    ).resolves.toEqual({
      kind: "error",
      reason: "unauthorized",
      status: 401,
    });

    await expect(
      getArtifactDeliveryDescriptor("job-phase150", "artifact-phase150", {
        fetchFn: async () => new Response("{}", { status: 403 }),
      }),
    ).resolves.toEqual({
      kind: "error",
      reason: "forbidden",
      status: 403,
    });
  });

  test("descriptor service is not store wired and does not add navigation storage signed url or public delivery behavior", async () => {
    const serviceSource = readSource("src/services/artifactDeliveryDescriptorService.ts");
    const storeSource = readSource("src/store/exportStore.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    const frontendSource =
      serviceSource +
      "\n" +
      storeSource +
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

    expect(serviceSource).toContain("getArtifactDeliveryDescriptor");
    expect(serviceSource).toContain("parseArtifactDeliveryDescriptorPayload");
    expect(serviceSource).toContain("artifact_delivery_unavailable");
    expect(serviceSource).toContain("artifact_delivery_ready");

    expect(routeSource).toContain('"/exports/:jobId/artifacts/:artifactId/delivery"');
    expect(routeSource).toContain("resolveBackendMediatedArtifactDelivery");

    expect(storeSource).not.toContain("getArtifactDeliveryDescriptor");

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
