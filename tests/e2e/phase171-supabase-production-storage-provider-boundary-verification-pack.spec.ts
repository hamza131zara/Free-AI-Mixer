import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createSupabaseProductionStorageProvider,
  type SupabaseProductionStorageClient,
} from "../../backend/artifacts/supabaseProductionStorageProvider";

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

const createClient = (
  response: {
    data: Array<{ name: string; metadata?: { mimetype?: string; size?: number } }> | null;
    error: { message?: string } | null;
  },
): SupabaseProductionStorageClient => ({
  storage: {
    from: () => ({
      list: async () => response,
    }),
  },
});

test.describe("phase171 supabase production storage provider boundary verification pack", () => {
  test("supabase production storage provider fails closed for missing config invalid refs and unsupported providers", async () => {
    const missingConfigProvider = createSupabaseProductionStorageProvider({});

    await expect(
      missingConfigProvider.verifyObject({
        artifactId: "artifact-phase171",
        storageRef: validStorageRef,
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "not_configured",
    });

    const provider = createSupabaseProductionStorageProvider({
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
      allowedBucket: "exports",
      client: createClient({ data: [], error: null }),
    });

    await expect(
      provider.verifyObject({
        artifactId: "artifact-phase171",
        storageRef: {
          provider: "s3",
          bucket: "exports",
          objectKey: "workspace/job/artifact.mp4",
        },
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "unsupported_provider",
    });

    await expect(
      provider.verifyObject({
        artifactId: "artifact-phase171",
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
      provider.verifyObject({
        artifactId: "artifact-phase171",
        storageRef: {
          provider: "supabase_storage",
          bucket: "other-bucket",
          objectKey: "workspace/job/artifact.mp4",
        },
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "invalid_storage_ref",
    });
  });

  test("supabase production storage provider verifies object existence and maps missing/provider errors safely", async () => {
    const verifiedProvider = createSupabaseProductionStorageProvider({
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
      allowedBucket: "exports",
      client: createClient({
        data: [
          {
            name: "artifact.mp4",
            metadata: {
              mimetype: "video/mp4",
              size: 1024,
            },
          },
        ],
        error: null,
      }),
    });

    await expect(
      verifiedProvider.verifyObject({
        artifactId: "artifact-phase171",
        storageRef: validStorageRef,
      }),
    ).resolves.toEqual({
      kind: "verified",
      provider: "supabase_storage",
      bucket: "exports",
      objectKey: "workspace/job/artifact.mp4",
      contentType: "video/mp4",
      sizeBytes: 1024,
    });

    const missingProvider = createSupabaseProductionStorageProvider({
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
      allowedBucket: "exports",
      client: createClient({
        data: [],
        error: null,
      }),
    });

    await expect(
      missingProvider.verifyObject({
        artifactId: "artifact-phase171",
        storageRef: validStorageRef,
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "object_not_found",
    });

    const unavailableProvider = createSupabaseProductionStorageProvider({
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
      allowedBucket: "exports",
      client: createClient({
        data: null,
        error: { message: "storage unavailable" },
      }),
    });

    await expect(
      unavailableProvider.verifyObject({
        artifactId: "artifact-phase171",
        storageRef: validStorageRef,
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      reason: "provider_unavailable",
    });
  });

  test("supabase provider remains backend-only not route-wired and adds no delivery shortcuts", async () => {
    const providerSource = readSource("backend/artifacts/supabaseProductionStorageProvider.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    const backendArtifactSource =
      providerSource +
      "\n" +
      readSource("backend/artifacts/productionStorageProvider.ts") +
      "\n" +
      readSource("backend/artifacts/productionStorageProviderIntegration.ts") +
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

    expect(providerSource).toContain("createSupabaseProductionStorageProvider");
    expect(providerSource).toContain("verifyObject");
    expect(providerSource).toContain("object_not_found");
    expect(providerSource).toContain("provider_unavailable");

    // Phase 171 adds provider boundary + verification only. Route wiring remains deferred.
    expect(routeSource).not.toContain("createSupabaseProductionStorageProvider");
    expect(routeSource).toContain("resolveProductionStorageReadiness");

    expect(providerSource).not.toContain("createSignedUrl");
    expect(providerSource).not.toContain("getPublicUrl");
    expect(providerSource).not.toContain("window.open");
    expect(providerSource).not.toContain("location.href");
    expect(providerSource).not.toContain("document.createElement");
    expect(providerSource).not.toContain(".click()");

    expect(routeSource).not.toContain('req.headers["x-user-id"]');
    expect(routeSource).not.toContain('req.headers["x-workspace-id"]');
    expect(routeSource).not.toContain("fakeSession");
    expect(routeSource).not.toContain("mockAuthenticatedUser");
    expect(routeSource).not.toContain("createSignedUrl");
    expect(routeSource).not.toContain("getPublicUrl");

    expect(backendArtifactSource).not.toContain("createSignedUrl");
    expect(backendArtifactSource).not.toContain("getPublicUrl");
    expect(backendArtifactSource).not.toContain("production_ready_public_delivery");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("createSignedUrl");
    expect(frontendSource).not.toContain("getPublicUrl");
    expect(frontendSource).not.toContain("window.open");
    expect(frontendSource).not.toContain("location.href");
    expect(frontendSource).not.toContain("document.createElement");
    expect(frontendSource).not.toContain(".click()");
  });
});

