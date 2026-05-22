import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  decideProductionSecurityAbuseBoundary,
} from "../../backend/security/productionSecurityAbuseBoundary";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase177 production security regression abuse boundary pack", () => {
  test("security abuse boundary blocks unauthenticated forbidden expired unsafe and rate limited states", async () => {
    expect(
      decideProductionSecurityAbuseBoundary({
        authenticated: false,
        authorized: false,
        safeMetadataOnly: true,
      }),
    ).toEqual({
      kind: "blocked",
      reason: "unauthenticated",
      safeToProceed: false,
    });

    expect(
      decideProductionSecurityAbuseBoundary({
        authenticated: true,
        authorized: false,
        safeMetadataOnly: true,
      }),
    ).toEqual({
      kind: "blocked",
      reason: "forbidden",
      safeToProceed: false,
    });

    expect(
      decideProductionSecurityAbuseBoundary({
        authenticated: true,
        authorized: true,
        safeMetadataOnly: true,
        descriptorExpiresAt: "2026-01-01T00:00:00.000Z",
        now: new Date("2026-01-01T00:00:01.000Z"),
      }),
    ).toEqual({
      kind: "blocked",
      reason: "expired_descriptor",
      safeToProceed: false,
    });

    expect(
      decideProductionSecurityAbuseBoundary({
        authenticated: true,
        authorized: true,
        safeMetadataOnly: false,
      }),
    ).toEqual({
      kind: "blocked",
      reason: "unsafe_metadata",
      safeToProceed: false,
    });

    expect(
      decideProductionSecurityAbuseBoundary({
        authenticated: true,
        authorized: true,
        safeMetadataOnly: true,
        navigationTarget: "file:///tmp/artifact.mp4",
      }),
    ).toEqual({
      kind: "blocked",
      reason: "unsafe_navigation_target",
      safeToProceed: false,
    });

    expect(
      decideProductionSecurityAbuseBoundary({
        authenticated: true,
        authorized: true,
        safeMetadataOnly: true,
        requestCountInWindow: 61,
        maxRequestsPerWindow: 60,
      }),
    ).toEqual({
      kind: "blocked",
      reason: "rate_limit_exceeded",
      safeToProceed: false,
    });
  });

  test("security abuse boundary allows only authenticated authorized safe non-expired descriptor flow", async () => {
    expect(
      decideProductionSecurityAbuseBoundary({
        authenticated: true,
        authorized: true,
        safeMetadataOnly: true,
        descriptorExpiresAt: "2026-01-01T00:05:00.000Z",
        navigationTarget: "https://signed.example/storage/object/artifact.mp4?token=redacted",
        now: new Date("2026-01-01T00:00:00.000Z"),
        requestCountInWindow: 10,
        maxRequestsPerWindow: 60,
      }),
    ).toEqual({
      kind: "allowed",
      safeToProceed: true,
    });

    expect(
      decideProductionSecurityAbuseBoundary({
        authenticated: true,
        authorized: true,
        safeMetadataOnly: true,
        descriptorExpiresAt: "2026-01-01T00:05:00.000Z",
        navigationTarget: "/exports/job-phase177/artifacts/artifact-phase177/stream",
        now: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toEqual({
      kind: "allowed",
      safeToProceed: true,
    });
  });

  test("production security regression keeps route frontend and docs free of unsafe launch shortcuts", async () => {
    const boundarySource = readSource("backend/security/productionSecurityAbuseBoundary.ts");
    const routeSource = readSource("backend/routes/exports.ts");

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

    const docsSource =
      readSource("docs/phases.md") +
      "\n" +
      readSource("docs/known-issues.md");

    expect(boundarySource).toContain("decideProductionSecurityAbuseBoundary");
    expect(boundarySource).toContain("rate_limit_exceeded");
    expect(boundarySource).toContain("expired_descriptor");
    expect(boundarySource).toContain("unsafe_metadata");

    expect(routeSource).toContain("getExportRouteAuthorizationFailure");
    expect(routeSource).toContain("sendExportRouteAuthorizationFailure");
    expect(routeSource).toContain("isSafeArtifactDeliveryMetadata");
    expect(routeSource).toContain("signedUrlDeliveryProvider");

    expect(routeSource + frontendSource + docsSource).not.toContain("fakeSession");
    expect(routeSource + frontendSource + docsSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource + frontendSource + docsSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource + frontendSource + docsSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource + frontendSource + docsSource).not.toContain("production_ready_public_delivery");
    expect(routeSource + frontendSource + docsSource).not.toContain("PUBLIC_LAUNCH_ENABLED=true");
    expect(routeSource + frontendSource + docsSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY=");
    expect(routeSource + frontendSource + docsSource).not.toContain("-----BEGIN PRIVATE KEY-----");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("location.href");
    expect(frontendSource).not.toContain("document.createElement");
    expect(frontendSource).not.toContain(".click()");
  });
});
