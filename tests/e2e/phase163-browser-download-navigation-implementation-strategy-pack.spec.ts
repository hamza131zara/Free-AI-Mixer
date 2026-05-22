import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  decideArtifactDownloadNavigation,
  isArtifactDownloadDescriptorExpired,
} from "../../src/services/artifactDownloadNavigationStrategy";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const readyDescriptor = {
  kind: "ready" as const,
  deliveryMode: "backend_mediated" as const,
  jobId: "job-phase163",
  artifactId: "artifact-phase163",
  backendRoutePath: "/exports/job-phase163/artifacts/artifact-phase163/stream",
  expiresAt: "2026-01-01T00:05:00.000Z",
};

test.describe("phase163 browser download navigation implementation strategy pack", () => {
  test("navigation strategy stays blocked by default and only permits explicitly allowed unexpired backend descriptor", async () => {
    expect(decideArtifactDownloadNavigation({})).toEqual({
      kind: "blocked",
      reason: "no_descriptor",
    });

    expect(
      decideArtifactDownloadNavigation({
        descriptor: {
          kind: "unavailable",
          reason: "workspace_or_rls_not_ready",
        },
      }),
    ).toEqual({
      kind: "blocked",
      reason: "descriptor_unavailable",
    });

    expect(
      decideArtifactDownloadNavigation({
        descriptor: readyDescriptor,
        now: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toEqual({
      kind: "blocked",
      reason: "browser_navigation_disabled",
    });

    expect(
      decideArtifactDownloadNavigation({
        descriptor: readyDescriptor,
        allowBrowserNavigation: true,
        now: new Date("2026-01-01T00:06:00.000Z"),
      }),
    ).toEqual({
      kind: "blocked",
      reason: "descriptor_expired",
    });

    expect(
      decideArtifactDownloadNavigation({
        descriptor: readyDescriptor,
        allowBrowserNavigation: true,
        now: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toEqual({
      kind: "permitted",
      deliveryMode: "backend_mediated",
      jobId: "job-phase163",
      artifactId: "artifact-phase163",
      backendRoutePath: "/exports/job-phase163/artifacts/artifact-phase163/stream",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });

    expect(
      isArtifactDownloadDescriptorExpired(
        "2026-01-01T00:05:00.000Z",
        new Date("2026-01-01T00:06:00.000Z"),
      ),
    ).toBe(true);
  });

  test("navigation strategy is decision-only and adds no browser navigation implementation", async () => {
    const strategySource = readSource("src/services/artifactDownloadNavigationStrategy.ts");

    expect(strategySource).toContain("decideArtifactDownloadNavigation");
    expect(strategySource).toContain("browser_navigation_disabled");
    expect(strategySource).toContain("descriptor_expired");
    expect(strategySource).toContain("backend_mediated");

    expect(strategySource).not.toContain("window.open");
    expect(strategySource).not.toContain("location.href");
    expect(strategySource).not.toContain("document.createElement");
    expect(strategySource).not.toContain(".click()");
    expect(strategySource).not.toContain("@supabase/supabase-js");
    expect(strategySource).not.toContain("createClient(");
    expect(strategySource).not.toContain(".storage.from(");
    expect(strategySource).not.toContain("createSignedUrl");
    expect(strategySource).not.toContain("getPublicUrl");
  });

  test("browser navigation remains blocked in frontend backend and artifact delivery sources", async () => {
    const frontendSource =
      readSource("src/services/artifactDownloadNavigationStrategy.ts") +
      "\n" +
      readSource("src/components/TimelineExportPanel.tsx") +
      "\n" +
      readSource("src/components/ArtifactDeliveryDescriptorAction.tsx") +
      "\n" +
      readSource("src/components/ArtifactDownloadAction.tsx") +
      "\n" +
      readSource("src/services/artifactDownloadUiState.ts") +
      "\n" +
      readSource("src/store/artifactDeliveryDescriptorStore.ts") +
      "\n" +
      readSource("src/services/artifactDeliveryDescriptorService.ts") +
      "\n" +
      readSource("src/services/exportService.ts") +
      "\n" +
      readSource("src/store/exportStore.ts") +
      "\n" +
      readIfExists("src/types/exportJob.ts") +
      "\n" +
      readIfExists("src/services/exportHandleStorage.ts");

    const routeSource = readSource("backend/routes/exports.ts");

    const backendArtifactSource =
      readSource("backend/artifacts/artifactDeliveryReadyPreconditions.ts") +
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

    expect(frontendSource).toContain("decideArtifactDownloadNavigation");
    expect(frontendSource).toContain("ArtifactDownloadAction");
    expect(frontendSource).toContain("backend_mediated");

    expect(routeSource).toContain("decideArtifactDeliveryReadyPreconditions");
    expect(routeSource).toContain("workspaceMembershipOrRlsReady: false");
    expect(routeSource).toContain("providerConfigured: false");
    expect(routeSource).toContain("providerCanResolve: false");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");
    expect(frontendSource).not.toContain("document.createElement");
    expect(frontendSource).not.toContain(".click()");

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
  });
});
