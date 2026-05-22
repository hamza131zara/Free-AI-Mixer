import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArtifactDeliveryDescriptorPayload } from "../../src/services/artifactDeliveryDescriptorService";
import { useArtifactDeliveryDescriptorStore } from "../../src/store/artifactDeliveryDescriptorStore";
import {
  decideArtifactDownloadNavigation,
  navigateToArtifactDownloadDescriptor,
} from "../../src/services/artifactDownloadNavigationStrategy";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase174c controlled e2e artifact delivery smoke pack", () => {
  test("controlled signed url descriptor flows through parser store and user-triggered navigation decision", async () => {
    useArtifactDeliveryDescriptorStore.getState().resetArtifactDeliveryDescriptors();

    const payload = {
      kind: "artifact_delivery_ready",
      deliveryMode: "backend_signed_url",
      jobId: "job-phase174c",
      artifactId: "artifact-phase174c",
      signedUrl: "https://signed.example/storage/object/artifact.mp4?token=redacted",
      expiresAt: "2026-01-01T00:05:00.000Z",
    };

    const parsed = parseArtifactDeliveryDescriptorPayload(payload);

    expect(parsed).toEqual({
      kind: "ready",
      deliveryMode: "backend_signed_url",
      jobId: "job-phase174c",
      artifactId: "artifact-phase174c",
      signedUrl: "https://signed.example/storage/object/artifact.mp4?token=redacted",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });

    const entry = await useArtifactDeliveryDescriptorStore
      .getState()
      .requestArtifactDeliveryDescriptor("job-phase174c", "artifact-phase174c", {
        fetchFn: async () =>
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }),
      });

    expect(entry).toEqual(parsed);

    const stored = useArtifactDeliveryDescriptorStore
      .getState()
      .getDescriptorState("job-phase174c", "artifact-phase174c");

    expect(stored).toEqual(parsed);

    if (stored.kind !== "ready") {
      throw new Error("Expected ready descriptor");
    }

    expect(
      decideArtifactDownloadNavigation({
        descriptor: stored,
        allowBrowserNavigation: false,
        now: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toEqual({
      kind: "blocked",
      reason: "browser_navigation_disabled",
    });

    const opened: Array<{ url: string; target?: string; features?: string }> = [];

    const decision = navigateToArtifactDownloadDescriptor({
      descriptor: stored,
      allowBrowserNavigation: true,
      now: new Date("2026-01-01T00:00:00.000Z"),
      windowRef: {
        open: (url, target, features) => {
          opened.push({ url, target, features });
          return null;
        },
      },
    });

    expect(decision.kind).toBe("permitted");
    expect(opened).toEqual([
      {
        url: "https://signed.example/storage/object/artifact.mp4?token=redacted",
        target: "_blank",
        features: "noopener,noreferrer",
      },
    ]);
  });

  test("controlled smoke blocks unavailable expired and unsafe descriptor states", async () => {
    const unavailable = parseArtifactDeliveryDescriptorPayload({
      kind: "artifact_delivery_unavailable",
      reason: "storage_not_configured",
    });

    expect(unavailable).toEqual({
      kind: "unavailable",
      reason: "storage_not_configured",
    });

    expect(
      decideArtifactDownloadNavigation({
        descriptor: unavailable,
        allowBrowserNavigation: true,
      }),
    ).toEqual({
      kind: "blocked",
      reason: "descriptor_unavailable",
    });

    const expired = parseArtifactDeliveryDescriptorPayload({
      kind: "artifact_delivery_ready",
      deliveryMode: "backend_signed_url",
      jobId: "job-phase174c",
      artifactId: "artifact-phase174c",
      signedUrl: "https://signed.example/storage/object/artifact.mp4?token=redacted",
      expiresAt: "2026-01-01T00:00:00.000Z",
    });

    if (expired.kind !== "ready") {
      throw new Error("Expected ready descriptor");
    }

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

    const unsafe = parseArtifactDeliveryDescriptorPayload({
      kind: "artifact_delivery_ready",
      deliveryMode: "backend_signed_url",
      jobId: "job-phase174c",
      artifactId: "artifact-phase174c",
      signedUrl: "http://unsigned.example/artifact.mp4",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });

    if (unsafe.kind !== "ready") {
      throw new Error("Expected ready descriptor");
    }

    expect(
      decideArtifactDownloadNavigation({
        descriptor: unsafe,
        allowBrowserNavigation: true,
        now: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toEqual({
      kind: "blocked",
      reason: "invalid_navigation_target",
    });
  });

  test("controlled smoke remains backend mediated with no direct frontend storage public url or service role behavior", async () => {
    const frontendSource =
      readSource("src/services/artifactDeliveryDescriptorService.ts") +
      "\n" +
      readSource("src/store/artifactDeliveryDescriptorStore.ts") +
      "\n" +
      readSource("src/services/artifactDownloadNavigationStrategy.ts") +
      "\n" +
      readSource("src/components/ArtifactDeliveryDescriptorAction.tsx") +
      "\n" +
      readSource("src/components/ArtifactDownloadAction.tsx") +
      "\n" +
      readIfExists("src/services/supabaseClient.ts") +
      "\n" +
      readIfExists("src/lib/supabase.ts");

    const backendRouteSource = readSource("backend/routes/exports.ts");

    expect(frontendSource).toContain("backend_signed_url");
    expect(frontendSource).toContain("navigateToArtifactDownloadDescriptor");
    expect(frontendSource).toContain("targetWindow.open");

    expect(backendRouteSource).toContain("signedUrlDeliveryProvider");
    expect(backendRouteSource).toContain("generateSignedUrl");
    expect(backendRouteSource).toContain("signedUrlResult.signedUrl");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain("SERVICE_ROLE");
    expect(frontendSource).not.toContain("location.href");
    expect(frontendSource).not.toContain("document.createElement");
    expect(frontendSource).not.toContain(".click()");
  });
});
