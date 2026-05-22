export type StorageBackupRecoveryMissingItem =
  | "private_storage_bucket_policy"
  | "signed_url_ttl_policy"
  | "artifact_retention_policy"
  | "failed_artifact_cleanup_policy"
  | "database_backup_policy"
  | "database_restore_plan"
  | "disaster_recovery_plan";

export type StorageBackupRecoveryReadinessDecision =
  | {
      kind: "ready";
      missingItems: [];
      storageBucketsPublic: false;
      backupsConfigured: true;
      publicLaunchEnabled: false;
    }
  | {
      kind: "not_ready";
      missingItems: StorageBackupRecoveryMissingItem[];
      storageBucketsPublic: false;
      backupsConfigured: false;
      publicLaunchEnabled: false;
    };

export interface StorageBackupRecoveryReadinessInput {
  storageRecoveryDocsText?: string;
  storagePolicyText?: string;
}

const hasAll = (source: string | undefined, tokens: string[]): boolean =>
  tokens.every((token) => source?.includes(token));

/**
 * Phase 180 storage policy, backup, and recovery readiness boundary.
 *
 * This helper validates documentation/readiness inputs only. It does not call
 * Supabase, apply bucket policies, run backups, delete artifacts, or enable
 * public launch.
 *
 * Safety rules:
 * - no remote storage calls
 * - no database backup execution
 * - no artifact deletion execution
 * - no service-role exposure
 * - no public bucket enablement
 * - no route behavior change
 */
export const resolveStorageBackupRecoveryReadiness = ({
  storageRecoveryDocsText,
  storagePolicyText,
}: StorageBackupRecoveryReadinessInput): StorageBackupRecoveryReadinessDecision => {
  const missingItems: StorageBackupRecoveryMissingItem[] = [];
  const combined = `${storageRecoveryDocsText ?? ""}\n${storagePolicyText ?? ""}`;

  if (!hasAll(combined, ["Storage bucket policy", "private by default", "no public bucket"])) {
    missingItems.push("private_storage_bucket_policy");
  }

  if (!hasAll(combined, ["Signed URL TTL policy", "short-lived", "backend-generated"])) {
    missingItems.push("signed_url_ttl_policy");
  }

  if (!hasAll(combined, ["Artifact retention strategy", "retention window", "manual review"])) {
    missingItems.push("artifact_retention_policy");
  }

  if (!hasAll(combined, ["Failed artifact cleanup", "failed exports", "safe cleanup"])) {
    missingItems.push("failed_artifact_cleanup_policy");
  }

  if (!hasAll(combined, ["Database backup expectations", "scheduled backups", "point-in-time recovery"])) {
    missingItems.push("database_backup_policy");
  }

  if (!hasAll(combined, ["Database restore plan", "restore drill", "rollback checklist"])) {
    missingItems.push("database_restore_plan");
  }

  if (!hasAll(combined, ["Disaster recovery notes", "incident response", "recovery owner"])) {
    missingItems.push("disaster_recovery_plan");
  }

  return missingItems.length === 0
    ? {
        kind: "ready",
        missingItems: [],
        storageBucketsPublic: false,
        backupsConfigured: true,
        publicLaunchEnabled: false,
      }
    : {
        kind: "not_ready",
        missingItems,
        storageBucketsPublic: false,
        backupsConfigured: false,
        publicLaunchEnabled: false,
      };
};
