import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createSupabaseSignedUrlDeliveryProvider,
  type SupabaseSignedUrlSigner,
} from "../../backend/artifacts/supabaseSignedUrlDeliveryProvider";

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

test.describe("phase173c supabase signed url provider pack", () => {
  test("supabase signed url provider fails closed for missing config invalid storage ref invalid ttl and missing signer", async () => {
    await expect(
      createSupabaseSignedUrlDeliveryProvider().generateSignedUrl({
        artifactId: "artifact-phase173c",
        storageRef: validStorageRef,
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "not_configured",
    });

    await expect(
      createSupabaseSignedUrlDeliveryProvider({
        config: {
          provider: "supabase_storage",
          bucket: "",
        },
      }).generateSignedUrl({
        artifactId: "artifact-phase173c",
        storageRef: validStorageRef,
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "not_configured",
    });

    await expect(
      createSupabaseSignedUrlDeliveryProvider({
        config: {
          provider: "supabase_storage",
          bucket: "exports",
        },
        signer: {
          signObjectUrl: async () => ({
            signedUrl: "https://signed.example/artifact-phase173c",
          }),
        },
      }).generateSignedUrl({
        artifactId: "artifact-phase173c",
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
      createSupabaseSignedUrlDeliveryProvider({
        config: {
          provider: "supabase_storage",
          bucket: "exports",
        },
      }).generateSignedUrl({
        artifactId: "artifact-phase173c",
        storageRef: validStorageRef,
        expiresInSeconds: 0,
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "invalid_expiry",
    });

    await expect(
      createSupabaseSignedUrlDeliveryProvider({
        config: {
          provider: "supabase_storage",
          bucket: "exports",
        },
      }).generateSignedUrl({
        artifactId: "artifact-phase173c",
        storageRef: validStorageRef,
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "provider_unavailable",
    });
  });

  test("supabase signed url provider uses injected signer caps ttl and refuses fake or invalid urls", async () => {
    const calls: Array<{ bucket: string; objectKey: string; expiresInSeconds: number }> = [];

    const signer: SupabaseSignedUrlSigner = {
      signObjectUrl: async ({ bucket, objectKey, expiresInSeconds }) => {
        calls.push({ bucket, objectKey, expiresInSeconds });

        return {
          signedUrl: "https://signed.example/storage/v1/object/sign/exports/workspace/job/artifact.mp4?token=redacted",
        };
      },
    };

    await expect(
      createSupabaseSignedUrlDeliveryProvider({
        config: {
          provider: "supabase_storage",
          bucket: "exports",
        },
        signer,
        now: () => new Date("2026-01-01T00:00:00.000Z"),
      }).generateSignedUrl({
        artifactId: "artifact-phase173c",
        storageRef: validStorageRef,
        expiresInSeconds: 999,
      }),
    ).resolves.toEqual({
      kind: "ready",
      deliveryMode: "backend_signed_url",
      artifactId: "artifact-phase173c",
      signedUrl: "https://signed.example/storage/v1/object/sign/exports/workspace/job/artifact.mp4?token=redacted",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });

    expect(calls).toEqual([
      {
        bucket: "exports",
        objectKey: "workspace/job/artifact.mp4",
        expiresInSeconds: 300,
      },
    ]);

    await expect(
      createSupabaseSignedUrlDeliveryProvider({
        config: {
          provider: "supabase_storage",
          bucket: "exports",
        },
        signer: {
          signObjectUrl: async () => ({
            signedUrl: "",
          }),
        },
      }).generateSignedUrl({
        artifactId: "artifact-phase173c",
        storageRef: validStorageRef,
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "signed_url_unavailable",
    });

    await expect(
      createSupabaseSignedUrlDeliveryProvider({
        config: {
          provider: "supabase_storage",
          bucket: "exports",
        },
        signer: {
          signObjectUrl: async () => ({
            signedUrl: "file:///tmp/artifact.mp4",
          }),
        },
      }).generateSignedUrl({
        artifactId: "artifact-phase173c",
        storageRef: validStorageRef,
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "signed_url_unavailable",
    });

    await expect(
      createSupabaseSignedUrlDeliveryProvider({
        config: {
          provider: "supabase_storage",
          bucket: "exports",
        },
        signer: {
          signObjectUrl: async () => {
            throw new Error("signer unavailable");
          },
        },
      }).generateSignedUrl({
        artifactId: "artifact-phase173c",
        storageRef: validStorageRef,
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "provider_unavailable",
    });
  });

  test("supabase signed url provider is backend only and not route frontend or public delivery wired", async () => {
    const providerSource = readSource("backend/artifacts/supabaseSignedUrlDeliveryProvider.ts");
    const routeSource = readSource("backend/routes/exports.ts");

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

    const optionalFrontendSource =
      readIfExists("src/services/supabaseClient.ts") +
      "\n" +
      readIfExists("src/lib/supabase.ts");

    expect(providerSource).toContain("createSupabaseSignedUrlDeliveryProvider");
    expect(providerSource).toContain("SignedUrlDeliveryProvider");
    expect(providerSource).toContain("signObjectUrl");
    expect(providerSource).toContain("MAX_SIGNED_URL_EXPIRES_IN_SECONDS");

    expect(providerSource).not.toContain("@supabase/supabase-js");
    expect(providerSource).not.toContain("createClient(");
    expect(providerSource).not.toContain(".storage.from(");
    expect(providerSource).not.toContain("getPublicUrl");
    expect(providerSource).not.toContain("service_role");
    expect(providerSource).not.toContain("SERVICE_ROLE");

    expect(routeSource).not.toContain("createSupabaseSignedUrlDeliveryProvider");
    expect(routeSource).toContain("SignedUrlDeliveryProvider");
    expect(routeSource).toContain("createSignedUrlDeliveryNotConfiguredProvider");
    expect(routeSource).toContain("signedUrlDeliveryProvider");
    expect(routeSource).toContain("generateSignedUrl");
    expect(routeSource).toContain("signedUrlResult.deliveryMode");
    expect(routeSource).toContain("signedUrl");
    expect(routeSource).toContain('readyPreconditionsDecision.kind !== "ready"');
    expect(routeSource).not.toContain("getPublicUrl");
    expect(routeSource).not.toContain("service_role");
    expect(routeSource).not.toContain("SERVICE_ROLE");

    expect(frontendSource + optionalFrontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource + optionalFrontendSource).not.toContain("createClient(");
    expect(frontendSource + optionalFrontendSource).not.toContain(".storage.from(");
    expect(frontendSource + optionalFrontendSource).not.toContain("createSignedUrl");
    expect(frontendSource + optionalFrontendSource).not.toContain("getPublicUrl");
    expect(frontendSource + optionalFrontendSource).not.toContain("signedUrl");
    expect(frontendSource + optionalFrontendSource).not.toContain("backend_signed_url");
    expect(frontendSource + optionalFrontendSource).not.toContain("window.open");
    expect(frontendSource + optionalFrontendSource).not.toContain("location.href");
    expect(frontendSource + optionalFrontendSource).not.toContain("document.createElement");
    expect(frontendSource + optionalFrontendSource).not.toContain(".click()");
  });
});




