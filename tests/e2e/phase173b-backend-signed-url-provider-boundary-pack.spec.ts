import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_SIGNED_URL_EXPIRES_IN_SECONDS,
  MAX_SIGNED_URL_EXPIRES_IN_SECONDS,
  createSignedUrlDeliveryNotConfiguredProvider,
  isSignedUrlDeliveryReady,
  isValidSignedUrlTtlSeconds,
  resolveSignedUrlExpiresAt,
  type SignedUrlDeliveryProvider,
} from "../../backend/artifacts/signedUrlDeliveryProvider";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const validStorageRef = {
  provider: "supabase_storage" as const,
  bucket: "exports",
  objectKey: "workspace/job/artifact.mp4",
  contentType: "video/mp4",
  sizeBytes: 1024,
};

test.describe("phase173b backend signed url provider boundary pack", () => {
  test("signed url provider boundary fails closed and enforces short-lived expiry limits", async () => {
    expect(DEFAULT_SIGNED_URL_EXPIRES_IN_SECONDS).toBe(300);
    expect(MAX_SIGNED_URL_EXPIRES_IN_SECONDS).toBe(300);

    expect(isValidSignedUrlTtlSeconds(1)).toBe(true);
    expect(isValidSignedUrlTtlSeconds(300)).toBe(true);
    expect(isValidSignedUrlTtlSeconds(0)).toBe(false);
    expect(isValidSignedUrlTtlSeconds(301)).toBe(false);
    expect(isValidSignedUrlTtlSeconds(1.5)).toBe(false);
    expect(isValidSignedUrlTtlSeconds(Number.NaN)).toBe(false);

    expect(
      resolveSignedUrlExpiresAt(
        new Date("2026-01-01T00:00:00.000Z"),
        300,
      ),
    ).toBe("2026-01-01T00:05:00.000Z");

    expect(
      resolveSignedUrlExpiresAt(
        new Date("2026-01-01T00:00:00.000Z"),
        301,
      ),
    ).toBeUndefined();

    const provider = createSignedUrlDeliveryNotConfiguredProvider();

    await expect(
      provider.generateSignedUrl({
        artifactId: "artifact-phase173b",
        storageRef: validStorageRef,
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "not_configured",
    });

    await expect(
      provider.generateSignedUrl({
        artifactId: "artifact-phase173b",
        storageRef: {
          provider: "supabase_storage",
          bucket: "exports",
          objectKey: "../artifact.mp4",
        },
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "invalid_storage_ref",
    });

    await expect(
      provider.generateSignedUrl({
        artifactId: "artifact-phase173b",
        storageRef: validStorageRef,
        expiresInSeconds: 999,
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "invalid_expiry",
    });
  });

  test("signed url provider boundary can represent ready result without route integration", async () => {
    const provider: SignedUrlDeliveryProvider = {
      generateSignedUrl: async ({ artifactId }) => ({
        kind: "ready",
        deliveryMode: "backend_signed_url",
        artifactId,
        signedUrl: "https://signed.example/artifact-phase173b?token=redacted",
        expiresAt: "2026-01-01T00:05:00.000Z",
      }),
    };

    const result = await provider.generateSignedUrl({
      artifactId: "artifact-phase173b",
      storageRef: validStorageRef,
      expiresInSeconds: 300,
    });

    expect(isSignedUrlDeliveryReady(result)).toBe(true);
    expect(result).toEqual({
      kind: "ready",
      deliveryMode: "backend_signed_url",
      artifactId: "artifact-phase173b",
      signedUrl: "https://signed.example/artifact-phase173b?token=redacted",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });
  });

  test("signed url provider boundary is not route wired and adds no frontend storage navigation or public url behavior", async () => {
    const signedUrlProviderSource = readSource("backend/artifacts/signedUrlDeliveryProvider.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    const backendArtifactSource =
      signedUrlProviderSource +
      "\n" +
      readSource("backend/artifacts/supabaseProductionStorageProvider.ts") +
      "\n" +
      readSource("backend/artifacts/productionStorageProviderIntegration.ts") +
      "\n" +
      readSource("backend/artifacts/productionStorageProvider.ts") +
      "\n" +
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

    const frontendSource =
      readSource("src/services/artifactDownloadNavigationStrategy.ts") +
      "\n" +
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

    expect(signedUrlProviderSource).toContain("SignedUrlDeliveryProvider");
    expect(signedUrlProviderSource).toContain("createSignedUrlDeliveryNotConfiguredProvider");
    expect(signedUrlProviderSource).toContain("backend_signed_url");
    expect(signedUrlProviderSource).toContain("MAX_SIGNED_URL_EXPIRES_IN_SECONDS");

    expect(routeSource).not.toContain("SignedUrlDeliveryProvider");
    expect(routeSource).not.toContain("createSignedUrlDeliveryNotConfiguredProvider");
    expect(routeSource).not.toContain("generateSignedUrl");
    expect(routeSource).not.toContain("backend_signed_url");
    expect(routeSource).not.toContain("signedUrl");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("createSignedUrl");
    expect(routeSource).not.toContain("getPublicUrl");
    expect(routeSource).not.toContain("service_role");
    expect(routeSource).not.toContain("SERVICE_ROLE");

    expect(backendArtifactSource).not.toContain("createSignedUrl(");
    expect(backendArtifactSource).not.toContain("getPublicUrl");
    expect(backendArtifactSource).not.toContain("service_role");
    expect(backendArtifactSource).not.toContain("SERVICE_ROLE");
    expect(backendArtifactSource).not.toContain("production_ready_public_delivery");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("signedUrl");
    expect(frontendSource).not.toContain("backend_signed_url");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");
    expect(frontendSource).not.toContain("document.createElement");
    expect(frontendSource).not.toContain(".click()");
  });
});
