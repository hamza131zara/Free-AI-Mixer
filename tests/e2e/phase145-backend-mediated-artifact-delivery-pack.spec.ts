import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  isBackendMediatedArtifactDeliveryReady,
  resolveBackendMediatedArtifactDelivery,
} from "../../backend/artifacts/backendMediatedArtifactDelivery";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const baseRequest = {
  jobId: "job-phase145",
  artifactId: "artifact-phase145",
  requester: {
    userId: "user-phase145",
    workspaceId: "workspace-phase145",
  },
};

test.describe("phase145 backend mediated artifact delivery pack", () => {
  test("backend mediated delivery fails closed until auth rls storage and artifact readiness are satisfied", async () => {
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
  });

  test("backend mediated delivery can produce only a backend route descriptor when all preconditions are true", async () => {
    const result = resolveBackendMediatedArtifactDelivery(
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
    );

    expect(result).toEqual({
      kind: "ready",
      deliveryMode: "backend_mediated",
      jobId: "job-phase145",
      artifactId: "artifact-phase145",
      backendRoutePath: "/exports/job-phase145/artifacts/artifact-phase145/stream",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });

    expect(isBackendMediatedArtifactDeliveryReady(result)).toBe(true);
  });

  test("backend mediated delivery boundary is not route wired and does not add public delivery behavior", async () => {
    const boundarySource = readSource("backend/artifacts/backendMediatedArtifactDelivery.ts");
    const routeSource = readSource("backend/routes/exports.ts");
    const providerSource = readSource("backend/artifacts/productionArtifactDeliveryProvider.ts");

    expect(boundarySource).toContain("resolveBackendMediatedArtifactDelivery");
    expect(boundarySource).toContain('deliveryMode: "backend_mediated"');
    expect(boundarySource).toContain("workspace_or_rls_not_ready");

    expect(routeSource).not.toContain("resolveBackendMediatedArtifactDelivery");
    expect(routeSource).not.toContain("isBackendMediatedArtifactDeliveryReady");
    expect(providerSource).not.toContain("resolveBackendMediatedArtifactDelivery");

    const runtimeSource = routeSource + "\n" + providerSource + "\n" + boundarySource;

    expect(runtimeSource).not.toContain("createSignedUrl");
    expect(runtimeSource).not.toContain("getPublicUrl");
    expect(runtimeSource).not.toContain("service_role");
    expect(runtimeSource).not.toContain("SERVICE_ROLE");
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
