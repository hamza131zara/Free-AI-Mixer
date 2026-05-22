import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  parseArtifactDeliveryDescriptorPayload,
} from "../../src/services/artifactDeliveryDescriptorService";
import {
  decideArtifactDownloadNavigation,
  navigateToArtifactDownloadDescriptor,
} from "../../src/services/artifactDownloadNavigationStrategy";
import type { ArtifactDownloadDescriptor } from "../../src/services/artifactDownloadUiState";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase174b frontend download navigation implementation pack", () => {
  test("frontend parses backend signed url descriptor and navigates only on explicit user-approved action", async () => {
    const parsed = parseArtifactDeliveryDescriptorPayload({
      kind: "artifact_delivery_ready",
      deliveryMode: "backend_signed_url",
      jobId: "job-phase174b",
      artifactId: "artifact-phase174b",
      signedUrl: "https://signed.example/storage/object/artifact.mp4?token=redacted",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });

    expect(parsed).toEqual({
      kind: "ready",
      deliveryMode: "backend_signed_url",
      jobId: "job-phase174b",
      artifactId: "artifact-phase174b",
      signedUrl: "https://signed.example/storage/object/artifact.mp4?token=redacted",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });

    if (parsed.kind !== "ready") {
      throw new Error("Expected ready descriptor");
    }

    expect(
      decideArtifactDownloadNavigation({
        descriptor: parsed,
        allowBrowserNavigation: false,
        now: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toEqual({
      kind: "blocked",
      reason: "browser_navigation_disabled",
    });

    const opened: Array<{ url: string; target?: string; features?: string }> = [];

    const decision = navigateToArtifactDownloadDescriptor({
      descriptor: parsed,
      allowBrowserNavigation: true,
      now: new Date("2026-01-01T00:00:00.000Z"),
      windowRef: {
        open: (url, target, features) => {
          opened.push({ url, target, features });
          return null;
        },
      },
    });

    expect(decision).toEqual({
      kind: "permitted",
      deliveryMode: "backend_signed_url",
      jobId: "job-phase174b",
      artifactId: "artifact-phase174b",
      signedUrl: "https://signed.example/storage/object/artifact.mp4?token=redacted",
      navigationUrl: "https://signed.example/storage/object/artifact.mp4?token=redacted",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });

    expect(opened).toEqual([
      {
        url: "https://signed.example/storage/object/artifact.mp4?token=redacted",
        target: "_blank",
        features: "noopener,noreferrer",
      },
    ]);
  });

  test("frontend blocks expired unavailable invalid and unsafe descriptor navigation", async () => {
    const unavailable: ArtifactDownloadDescriptor = {
      kind: "unavailable",
      reason: "storage_not_configured",
    };

    expect(
      decideArtifactDownloadNavigation({
        descriptor: unavailable,
        allowBrowserNavigation: true,
      }),
    ).toEqual({
      kind: "blocked",
      reason: "descriptor_unavailable",
    });

    const expired: ArtifactDownloadDescriptor = {
      kind: "ready",
      deliveryMode: "backend_signed_url",
      jobId: "job-phase174b",
      artifactId: "artifact-phase174b",
      signedUrl: "https://signed.example/storage/object/artifact.mp4?token=redacted",
      expiresAt: "2026-01-01T00:00:00.000Z",
    };

    expect(
      decideArtifactDownloadNavigation({
        descriptor: expired,
        allowBrowserNavigation: true,
        now: new Date("2026-01-01T00:00:01.000Z"),
      }),
    ).toEqual({
      kind: "blocked",
      reason: "descriptor_expired",
    });

    const unsafeSignedUrl: ArtifactDownloadDescriptor = {
      kind: "ready",
      deliveryMode: "backend_signed_url",
      jobId: "job-phase174b",
      artifactId: "artifact-phase174b",
      signedUrl: "file:///tmp/artifact.mp4",
      expiresAt: "2026-01-01T00:05:00.000Z",
    };

    expect(
      decideArtifactDownloadNavigation({
        descriptor: unsafeSignedUrl,
        allowBrowserNavigation: true,
        now: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toEqual({
      kind: "blocked",
      reason: "invalid_navigation_target",
    });
  });

  test("download navigation remains descriptor based with no direct frontend storage or public url behavior", async () => {
    const navigationSource = readSource("src/services/artifactDownloadNavigationStrategy.ts");
    const actionSource = readSource("src/components/ArtifactDownloadAction.tsx");
    const descriptorActionSource = readSource("src/components/ArtifactDeliveryDescriptorAction.tsx");
    const descriptorServiceSource = readSource("src/services/artifactDeliveryDescriptorService.ts");
    const storeSource = readSource("src/store/artifactDeliveryDescriptorStore.ts");

    const optionalFrontendSource =
      readIfExists("src/services/supabaseClient.ts") +
      "\n" +
      readIfExists("src/lib/supabase.ts");

    const combinedFrontendSource =
      navigationSource +
      "\n" +
      actionSource +
      "\n" +
      descriptorActionSource +
      "\n" +
      descriptorServiceSource +
      "\n" +
      storeSource +
      "\n" +
      optionalFrontendSource;

    expect(navigationSource).toContain("navigateToArtifactDownloadDescriptor");
    expect(navigationSource).toContain("allowBrowserNavigation");
    expect(navigationSource).toContain("targetWindow.open");
    expect(descriptorActionSource).toContain("handleRequestDownload");
    expect(descriptorActionSource).toContain("navigateToArtifactDownloadDescriptor");
    expect(descriptorServiceSource).toContain("backend_signed_url");
    expect(descriptorServiceSource).toContain("signedUrl");

    expect(combinedFrontendSource).not.toContain("@supabase/supabase-js");
    expect(combinedFrontendSource).not.toContain("createClient(");
    expect(combinedFrontendSource).not.toContain(".storage.from(");
    expect(combinedFrontendSource).not.toContain("createSignedUrl");
    expect(combinedFrontendSource).not.toContain("getPublicUrl");
    expect(combinedFrontendSource).not.toContain("service_role");
    expect(combinedFrontendSource).not.toContain("SERVICE_ROLE");
    expect(combinedFrontendSource).not.toContain("location.href");
    expect(combinedFrontendSource).not.toContain("document.createElement");
    expect(combinedFrontendSource).not.toContain(".click()");
  });
});
