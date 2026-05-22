import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  resolveStorageBackupRecoveryReadiness,
} from "../../backend/storage/storageBackupRecoveryReadiness";
import {
  getPublicSupabaseConfig,
  parseSupabaseConfig,
} from "../../backend/config/supabaseConfig";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const storageRecoveryDocs = readSource("docs/storage-recovery.md");

test.describe("phase180 storage policy backup recovery pack", () => {
  test("storage backup recovery readiness fails closed for missing checklist inputs", async () => {
    expect(resolveStorageBackupRecoveryReadiness({})).toEqual({
      kind: "not_ready",
      missingItems: [
        "private_storage_bucket_policy",
        "signed_url_ttl_policy",
        "artifact_retention_policy",
        "failed_artifact_cleanup_policy",
        "database_backup_policy",
        "database_restore_plan",
        "disaster_recovery_plan",
      ],
      storageBucketsPublic: false,
      backupsConfigured: false,
      publicLaunchEnabled: false,
    });
  });

  test("storage backup recovery readiness validates policy backup cleanup restore and disaster recovery docs without enabling launch", async () => {
    expect(resolveStorageBackupRecoveryReadiness({
      storageRecoveryDocsText: storageRecoveryDocs,
      storagePolicyText: storageRecoveryDocs,
    })).toEqual({
      kind: "ready",
      missingItems: [],
      storageBucketsPublic: false,
      backupsConfigured: true,
      publicLaunchEnabled: false,
    });

    const config = parseSupabaseConfig({
      FREE_AI_MIXER_ENABLE_SUPABASE_DB: "1",
      FREE_AI_MIXER_DB_PROVIDER: "supabase",
      FREE_AI_MIXER_SUPABASE_URL: "https://example.supabase.co",
      FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY: "server-only-redacted",
      FREE_AI_MIXER_SUPABASE_ANON_KEY: "anon-redacted",
      FREE_AI_MIXER_STORAGE_BUCKET_ARTIFACTS: "exports",
      FREE_AI_MIXER_STORAGE_BUCKET_UPLOADS: "uploads",
    });

    expect(config.valid).toBe(true);
    expect(getPublicSupabaseConfig(config)).toEqual({
      enabled: true,
      valid: true,
      dbProvider: "supabase",
      appMode: "local",
      projectUrl: "https://example.supabase.co",
      anonKey: "anon-redacted",
      storageBucketArtifacts: "exports",
      storageBucketUploads: "uploads",
    });
  });

  test("storage recovery docs and storage providers avoid public bucket launch shortcuts and unsafe frontend storage", async () => {
    const readinessSource = readSource("backend/storage/storageBackupRecoveryReadiness.ts");
    const storageProviderSource =
      readSource("backend/artifacts/supabaseProductionStorageProvider.ts") +
      "\n" +
      readSource("backend/artifacts/supabaseSignedUrlDeliveryProvider.ts") +
      "\n" +
      readSource("backend/artifacts/productionStorageProviderIntegration.ts");
    const registrySource =
      readSource("backend/registry/supabaseExportJobRegistry.ts") +
      "\n" +
      readIfExists("backend/registry/exportJobRecoveryPolicy.ts");
    const frontendSource =
      readSource("src/services/artifactDeliveryDescriptorService.ts") +
      "\n" +
      readSource("src/services/artifactDownloadNavigationStrategy.ts") +
      "\n" +
      readIfExists("src/services/supabaseClient.ts") +
      "\n" +
      readIfExists("src/lib/supabase.ts");
    const docsSource = storageRecoveryDocs + "\n" + readSource("docs/phases.md") + "\n" + readSource("docs/known-issues.md");

    expect(readinessSource).toContain("resolveStorageBackupRecoveryReadiness");
    expect(readinessSource).toContain("storageBucketsPublic: false");
    expect(readinessSource).toContain("publicLaunchEnabled: false");

    expect(storageProviderSource).toContain("createSupabaseProductionStorageProvider");
    expect(storageProviderSource).toContain("createSupabaseSignedUrlDeliveryProvider");
    expect(storageProviderSource).toContain("verifyObject");
    expect(storageProviderSource).toContain("generateSignedUrl");
    expect(storageProviderSource).not.toContain("getPublicUrl");
    expect(storageProviderSource).not.toContain("publicUrl");

    expect(registrySource).toContain("claim");
    expect(registrySource).toContain("markError");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("getPublicUrl");

    expect(docsSource).toContain("private by default");
    expect(docsSource).toContain("point-in-time recovery");
    expect(docsSource).toContain("Public launch remains blocked");
    expect(docsSource).not.toContain("PUBLIC_LAUNCH_ENABLED=true");
    expect(docsSource).not.toContain("public_bucket_enabled=true");
    expect(docsSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY=");
    expect(docsSource).not.toContain("-----BEGIN PRIVATE KEY-----");
  });
});
