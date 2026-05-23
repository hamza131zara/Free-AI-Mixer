import { expect, test, type Page } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  decideArtifactDeliveryReadyPreconditions,
} from "../../backend/artifacts/artifactDeliveryReadyPreconditions";
import {
  decideArtifactDownloadNavigation,
  navigateToArtifactDownloadDescriptor,
} from "../../src/services/artifactDownloadNavigationStrategy";
import type { ArtifactDownloadDescriptor } from "../../src/services/artifactDownloadUiState";

const projectRoot = process.cwd();

const frontendDownloadBoundaryFiles = [
  "src/components/ArtifactDownloadAction.tsx",
  "src/components/ArtifactDeliveryDescriptorAction.tsx",
  "src/components/TimelineExportPanel.tsx",
  "src/services/artifactDeliveryDescriptorService.ts",
  "src/services/artifactDownloadNavigationStrategy.ts",
  "src/services/artifactDownloadUiState.ts",
  "src/store/artifactDeliveryDescriptorStore.ts",
];

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const listFrontendSourceFiles = (directory: string): string[] => {
  const fullPath = path.join(projectRoot, directory);
  const entries = readdirSync(fullPath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const relativePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listFrontendSourceFiles(relativePath);
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      return [relativePath];
    }

    return [];
  });
};

const gotoMixer = async (page: Page): Promise<void> => {
  await page.goto("/mixer", { waitUntil: "load" });
  await expect(page.getByRole("heading", { name: "Free AI Mixer" })).toBeVisible();
};

test.describe("product phase 7 artifact delivery readiness", () => {
  test("artifact delivery readiness remains unavailable by default for missing storage, expired artifacts, and unsigned delivery", () => {
    expect(
      decideArtifactDeliveryReadyPreconditions({
        authorization: {
          ownerOrWorkspaceAccessAllowed: true,
          workspaceMembershipOrRlsReady: true,
        },
        artifact: {
          metadataExists: true,
          artifactIdMatches: true,
          status: "expired",
          safeMetadataOnly: true,
        },
        storage: {
          storageRefExists: true,
          storageRefValid: true,
          providerConfigured: true,
          providerCanResolve: true,
        },
        signedDelivery: {
          providerConfigured: true,
        },
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "artifact_expired",
    });

    expect(
      decideArtifactDeliveryReadyPreconditions({
        authorization: {
          ownerOrWorkspaceAccessAllowed: true,
          workspaceMembershipOrRlsReady: true,
        },
        artifact: {
          metadataExists: true,
          artifactIdMatches: true,
          status: "available",
          safeMetadataOnly: true,
        },
        storage: {
          storageRefExists: false,
          storageRefValid: false,
          providerConfigured: false,
          providerCanResolve: false,
        },
        signedDelivery: {
          providerConfigured: false,
        },
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "storage_ref_missing",
    });

    expect(
      decideArtifactDeliveryReadyPreconditions({
        authorization: {
          ownerOrWorkspaceAccessAllowed: true,
          workspaceMembershipOrRlsReady: true,
        },
        artifact: {
          metadataExists: true,
          artifactIdMatches: true,
          status: "available",
          safeMetadataOnly: true,
        },
        storage: {
          storageRefExists: true,
          storageRefValid: true,
          providerConfigured: true,
          providerCanResolve: true,
        },
        signedDelivery: {
          providerConfigured: false,
        },
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "signed_url_not_configured",
    });
  });

  test("frontend download remains descriptor based and explicit user triggered only", async () => {
    const descriptor: ArtifactDownloadDescriptor = {
      kind: "ready",
      deliveryMode: "backend_signed_url",
      jobId: "phase7-job",
      artifactId: "phase7-artifact",
      signedUrl: "https://example.test/download-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
    };

    expect(
      decideArtifactDownloadNavigation({
        descriptor,
        allowBrowserNavigation: false,
        now: new Date("2026-05-23T00:00:00.000Z"),
      }),
    ).toEqual({
      kind: "blocked",
      reason: "browser_navigation_disabled",
    });

    const opened: Array<{ url: string; target?: string; features?: string }> = [];

    const result = navigateToArtifactDownloadDescriptor({
      descriptor,
      allowBrowserNavigation: true,
      now: new Date("2026-05-23T00:00:00.000Z"),
      windowRef: {
        open: (url, target, features) => {
          opened.push({ url, target, features });
          return null;
        },
      },
    });

    expect(result).toEqual({
      kind: "permitted",
      deliveryMode: "backend_signed_url",
      jobId: "phase7-job",
      artifactId: "phase7-artifact",
      signedUrl: "https://example.test/download-token",
      navigationUrl: "https://example.test/download-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    expect(opened).toEqual([
      {
        url: "https://example.test/download-token",
        target: "_blank",
        features: "noopener,noreferrer",
      },
    ]);
  });

  test("mixer shell still renders and frontend avoids supabase storage and download shortcuts", async ({
    page,
  }) => {
    await gotoMixer(page);

    const frontendSource = listFrontendSourceFiles("src")
      .map((relativePath) => readSource(relativePath))
      .join("\n");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain("SERVICE_ROLE");

    const downloadSource = frontendDownloadBoundaryFiles
      .map((relativePath) => readSource(relativePath))
      .join("\n");

    expect(downloadSource).toContain("navigateToArtifactDownloadDescriptor");
    expect(downloadSource).toContain("targetWindow.open");
    expect(downloadSource).not.toContain("window.location.href");
    expect(downloadSource).not.toContain("location.href =");
    expect(downloadSource).not.toContain("document.createElement");
    expect(downloadSource).not.toContain(".click()");
  });
});
