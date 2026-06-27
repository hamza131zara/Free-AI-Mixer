import type {
  BackendArtifactAccessOwnership,
  BackendArtifactStorageMetadataOwnership,
  BackendUserAccountIdentity,
  BackendWorkspace,
  BackendWorkspaceCreditLedgerEntry,
  BackendWorkspaceMembership,
  BackendWorkspaceProviderKeyOwnership,
} from "../auth/accountContracts";
import type { CanonicalPlatformRole } from "../auth/platformRoleNormalization";
import type {
  BackendArtifactMetadata,
  BackendExportJobOwnerScope,
  BackendExportLifecycleStatus,
  BackendExportJobRecord,
} from "../contracts/exportHttpTypes";
import type {
  BackendRedactedProviderConnectionSummary,
  BackendSupportedProviderId,
} from "../contracts/providerSettingsHttpTypes";
import type {
  AuditTrailCategory,
  AuditTrailType,
} from "../observability/auditTrailContracts";
import type {
  EventActorKind,
  EventLogCategory,
  EventLogType,
  EventOutcome,
  EventSource,
} from "../observability/eventLogContracts";
import type { SafeEventMetadata } from "../observability/safeEventSanitizer";

export type BackendProviderKeyStatus = "active" | "rotated" | "disabled";
export type BackendProviderKeyVerificationStatus =
  | "not_validated"
  | "validated"
  | "validation_failed"
  | "needs_reverification";

export type BackendProviderKeyStorageMode =
  | "encrypted_payload"
  | "external_secret_ref";

export interface BackendEncryptedSecretPayload {
  encryptedPayload: string;
  keyVersion: string;
  algorithm: string;
}

export interface BackendProviderKeyRecord
  extends BackendWorkspaceProviderKeyOwnership {
  storageMode?: BackendProviderKeyStorageMode;
  encryptedSecret?: BackendEncryptedSecretPayload;
  secretRef?: string;
  status: BackendProviderKeyStatus;
  maskedFingerprint?: string;
  keyFingerprintSuffix?: string;
  lastVerifiedAt?: string;
  lastVerificationErrorCode?: string;
  verificationStatus?: BackendProviderKeyVerificationStatus;
  needsReverification?: boolean;
  rotatedAt?: string;
  revokedAt?: string;
  disabledAt?: string;
  deletedAt?: string;
  updatedByUserId?: string;
}

export interface BackendProviderKeyCreateInput {
  providerId: BackendSupportedProviderId;
  workspaceId: string;
  ownerId: string;
  createdByUserId: string;
  encryptedSecret?: BackendEncryptedSecretPayload;
  secretRef?: string;
  maskedFingerprint?: string;
  keyFingerprintSuffix?: string;
}

export interface BackendProviderKeyReplaceInput {
  providerKeyId: string;
  providerId: BackendSupportedProviderId;
  workspaceId: string;
  requesterUserId: string;
  encryptedSecret?: BackendEncryptedSecretPayload;
  secretRef?: string;
  maskedFingerprint?: string;
  keyFingerprintSuffix?: string;
}

export interface BackendProviderKeyRevokeInput {
  providerKeyId: string;
  workspaceId: string;
  requesterUserId: string;
}

export interface BackendProviderKeyValidationStateInput {
  providerKeyId: string;
  workspaceId: string;
  requesterUserId: string;
  verificationStatus: BackendProviderKeyVerificationStatus;
  lastVerifiedAt?: string;
  lastVerificationErrorCode?: string;
  needsReverification: boolean;
}

export type BackendProviderKeyStorageResult =
  | {
      kind: "stored";
      status: "stored";
      connection: BackendRedactedProviderConnectionSummary;
    }
  | {
      kind: "replaced";
      status: "replaced";
      connection: BackendRedactedProviderConnectionSummary;
    }
  | {
      kind: "revoked";
      status: "revoked";
      connection: BackendRedactedProviderConnectionSummary;
    }
  | {
      kind: "unavailable";
      status: "unavailable";
      code: "storage_not_configured" | "repository_unavailable";
      message: string;
    }
  | {
      kind: "unauthorized";
      status: "unauthorized";
      code: "workspace_owner_or_admin_required" | "workspace_permission_not_verified";
      message: string;
    }
  | {
      kind: "conflict";
      status: "conflict";
      code: "active_provider_key_exists" | "record_version_conflict";
      message: string;
    }
  | {
      kind: "invalid_provider";
      status: "invalid_provider";
      message: string;
    }
  | {
      kind: "vault_unavailable";
      status: "vault_unavailable";
      message: string;
    };

export type BackendProviderKeyValidationStateResult =
  | {
      kind: "validation_state_updated";
      status: "updated";
      connection: BackendRedactedProviderConnectionSummary;
    }
  | {
      kind: "validation_state_unavailable";
      status: "unavailable";
      code: "repository_unavailable" | "storage_not_configured";
      message: string;
    }
  | {
      kind: "validation_state_not_found";
      status: "not_found";
      message: string;
    };

export type BackendCreditLedgerEntryKind =
  BackendWorkspaceCreditLedgerEntry["entryKind"];

export interface BackendCreditLedgerReserveInput {
  workspaceId: string;
  ownerId: string;
  amount: number;
  reason: string;
  jobId?: string;
}

export interface BackendCreditLedgerChargeInput {
  workspaceId: string;
  ownerId: string;
  amount: number;
  reason: string;
  reservationEntryId?: string;
  jobId?: string;
}

export interface BackendCreditLedgerRefundInput {
  workspaceId: string;
  ownerId: string;
  amount: number;
  reason: string;
  chargeEntryId?: string;
  jobId?: string;
}

export interface BackendCreditLedgerGrantInput {
  workspaceId: string;
  ownerId: string;
  amount: number;
  reason: string;
}

export interface BackendCreditLedgerAdjustmentInput {
  workspaceId: string;
  ownerId: string;
  amountDelta: number;
  reason: string;
}

export type BackendCreditLedgerMutationInput =
  | { entryKind: "reserve"; input: BackendCreditLedgerReserveInput }
  | { entryKind: "charge"; input: BackendCreditLedgerChargeInput }
  | { entryKind: "refund"; input: BackendCreditLedgerRefundInput }
  | { entryKind: "grant"; input: BackendCreditLedgerGrantInput }
  | { entryKind: "adjustment"; input: BackendCreditLedgerAdjustmentInput };

export interface BackendArtifactRecord extends BackendArtifactAccessOwnership {
  format: string;
  kind: string;
  status: "available" | "missing" | "pending";
  createdAt: string;
  sizeBytes?: number;
}

export type BackendStorageProvider =
  | "supabase_storage"
  | "s3"
  | "r2"
  | "local_dev";

export interface BackendArtifactStorageRefRecord
  extends BackendArtifactStorageMetadataOwnership {
  storageProvider: BackendStorageProvider;
  objectKey: string;
  bucketName?: string;
  contentType?: string;
  byteLength?: number;
}

export type BackendSignedUrlReadiness =
  | "not_configured"
  | "requires_authorization"
  | "ready";

export interface BackendArtifactAccessReadinessRecord
  extends BackendArtifactAccessOwnership {
  signedUrlReadiness: BackendSignedUrlReadiness;
}

export interface BackendExportJobIdempotencyScope
  extends BackendExportJobOwnerScope {
  requestId: string;
}

export type BackendExportJobCreateIfAbsentResult =
  | { kind: "created"; record: BackendExportJobRecord }
  | { kind: "existing"; record: BackendExportJobRecord }
  | {
      kind: "conflict";
      reason: "job_id_mismatch" | "non_create_safe_difference";
      existingRecord: BackendExportJobRecord;
    };

export interface BackendExportJobClaimInput {
  jobId: string;
  workerId: string;
  claimTtlMs?: number;
  now?: string;
}

export type BackendExportJobClaimResult =
  | { kind: "claimed"; record: BackendExportJobRecord }
  | { kind: "not_found" }
  | { kind: "not_claimable"; reason: "terminal" | "status_not_submitted" }
  | { kind: "already_claimed"; existingRecord: BackendExportJobRecord };

export interface BackendExportJobTransitionInput {
  jobId: string;
  workerId: string;
  expectedCurrentStatus: BackendExportLifecycleStatus;
  nextStatus: BackendExportLifecycleStatus;
  now?: string;
  failureCode?: string;
  failureMessage?: string;
}

export type BackendExportJobTransitionResult =
  | { kind: "transitioned"; record: BackendExportJobRecord }
  | { kind: "not_found" }
  | { kind: "not_owned" }
  | { kind: "claim_expired" }
  | {
      kind: "not_transitionable";
      reason: "terminal" | "status_mismatch" | "invalid_transition";
    }
  | { kind: "version_conflict"; existingRecord: BackendExportJobRecord };

export interface BackendExportJobMarkSuccessInput {
  jobId: string;
  workerId: string;
  artifacts: BackendArtifactMetadata[];
  now?: string;
}

export type BackendExportJobMarkSuccessResult =
  | { kind: "succeeded"; record: BackendExportJobRecord }
  | { kind: "not_found" }
  | { kind: "not_owned" }
  | { kind: "claim_expired" }
  | {
      kind: "not_transitionable";
      reason: "terminal" | "status_mismatch";
    }
  | { kind: "version_conflict"; existingRecord: BackendExportJobRecord };

export interface BackendExportJobsRepository {
  createIfAbsent(
    record: BackendExportJobRecord,
  ): Promise<BackendExportJobCreateIfAbsentResult>;
  claimIfAvailable(
    input: BackendExportJobClaimInput,
  ): Promise<BackendExportJobClaimResult>;
  transitionIfOwned(
    input: BackendExportJobTransitionInput,
  ): Promise<BackendExportJobTransitionResult>;
  markSuccessIfOwned(
    input: BackendExportJobMarkSuccessInput,
  ): Promise<BackendExportJobMarkSuccessResult>;
  listByStatus(
    status: BackendExportLifecycleStatus,
    options?: { limit?: number },
  ): Promise<BackendExportJobRecord[]>;
  upsertJob(record: BackendExportJobRecord): Promise<BackendExportJobRecord>;
  getByJobId(jobId: string): Promise<BackendExportJobRecord | undefined>;
  getByIdempotencyScope(
    scope: BackendExportJobIdempotencyScope,
  ): Promise<BackendExportJobRecord | undefined>;
}

export interface BackendUserAccountRecord extends BackendUserAccountIdentity {
  email?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BackendWorkspaceRecord extends BackendWorkspace {
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface BackendWorkspaceMembershipRecord {
  workspaceId: string;
  userId: string;
  role: BackendWorkspaceMembership["role"];
  status: BackendWorkspaceMembership["status"] | "disabled";
  createdAt?: string;
  updatedAt?: string;
}

export type BackendProjectStatus = "active" | "archived" | "deleted";

export interface BackendProjectRecord {
  projectId: string;
  workspaceId: string;
  ownerId: string;
  title: string;
  status: BackendProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export type BackendActiveProjectSelectionResult =
  | {
      status: "selected";
      project: BackendProjectRecord;
    }
  | { status: "forbidden" }
  | { status: "not_found" };

export interface BackendProjectImageGenerationHistoryRecord {
  artifactId: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  createdAt: string;
  deliveryStatus: "unavailable";
  generationId: string;
  jobId: string;
  projectId: string;
  promptSummary?: string;
  providerId: "mock_local" | "openai";
  requestId: string;
  sha256: string;
  sizeBytes: number;
  status: "metadata_ready";
}

export type BackendPlatformRoleStatus = "active" | "disabled";

export interface BackendPlatformRoleRecord {
  userId: string;
  role: Exclude<CanonicalPlatformRole, "unknown">;
  status: BackendPlatformRoleStatus;
  source: "platform_roles";
  createdAt?: string;
  updatedAt?: string;
  disabledAt?: string;
}

export interface BackendAnalyticsEventRecord {
  eventId: string;
  eventType: EventLogType;
  category: EventLogCategory;
  occurredAt: string;
  actorKind: EventActorKind;
  actorUserId?: string;
  workspaceId?: string;
  actorRole?: string;
  targetType?: string;
  targetId?: string;
  outcome: EventOutcome;
  source: EventSource;
  requestId?: string;
  failureCode?: string;
  metadata: SafeEventMetadata;
}

export interface BackendAuditLogRecord {
  eventId: string;
  eventType: AuditTrailType;
  category: AuditTrailCategory;
  occurredAt: string;
  actorKind: EventActorKind;
  actorUserId?: string;
  workspaceId?: string;
  actorRole?: string;
  targetType?: string;
  targetId?: string;
  outcome: EventOutcome;
  source: EventSource;
  requestId?: string;
  failureCode?: string;
  metadata: SafeEventMetadata;
}

export interface BackendUserAccountRepository {
  getByUserId(userId: string): Promise<BackendUserAccountRecord | undefined>;
  getByAuthSubject(
    authProvider: BackendUserAccountIdentity["authProvider"],
    authSubject: string,
  ): Promise<BackendUserAccountRecord | undefined>;
  createOrGetByAuthSubject(input: {
    userId: string;
    authProvider: BackendUserAccountIdentity["authProvider"];
    authSubject: string;
    email?: string;
  }): Promise<BackendUserAccountRecord>;
}

export interface BackendWorkspaceRepository {
  getByWorkspaceId(
    workspaceId: string,
  ): Promise<BackendWorkspaceRecord | undefined>;
  listForUser(userId: string): Promise<BackendWorkspaceRecord[]>;
  createPersonalWorkspace(input: {
    workspaceId: string;
    userId: string;
    name: string;
  }): Promise<BackendWorkspaceRecord>;
}

export interface BackendWorkspaceMembershipRepository {
  getMembership(
    workspaceId: string,
    userId: string,
  ): Promise<BackendWorkspaceMembershipRecord | undefined>;
  listMembershipsForWorkspace(
    workspaceId: string,
  ): Promise<BackendWorkspaceMembershipRecord[]>;
  listMembershipsForUser(
    userId: string,
  ): Promise<BackendWorkspaceMembershipRecord[]>;
  createOrGetMembership(input: {
    workspaceId: string;
    userId: string;
    role: BackendWorkspaceMembershipRecord["role"];
    status: BackendWorkspaceMembershipRecord["status"];
  }): Promise<BackendWorkspaceMembershipRecord>;
}

export interface BackendProjectRepository {
  createProject(input: {
    ownerId: string;
    projectId: string;
    title: string;
    workspaceId: string;
  }): Promise<BackendProjectRecord>;
  listProjectsForWorkspace(workspaceId: string): Promise<BackendProjectRecord[]>;
  getProjectForWorkspace(
    workspaceId: string,
    projectId: string,
  ): Promise<BackendProjectRecord | undefined>;
  updateProjectTitleForWorkspace(input: {
    projectId: string;
    title: string;
    workspaceId: string;
  }): Promise<BackendProjectRecord | undefined>;
  getActiveProjectForWorkspaceUser?(
    workspaceId: string,
    userId: string,
  ): Promise<BackendProjectRecord | undefined>;
  setActiveProjectForWorkspaceUser?(input: {
    projectId: string;
    userId: string;
    workspaceId: string;
  }): Promise<BackendActiveProjectSelectionResult>;
  clearActiveProjectForWorkspaceUser?(
    workspaceId: string,
    userId: string,
  ): Promise<void>;
  softDeleteProjectForWorkspaceUser?(input: {
    projectId: string;
    userId: string;
    workspaceId: string;
  }): Promise<"deleted" | "forbidden" | "not_found">;
  listImageGenerationHistoryForProject?(
    workspaceId: string,
    projectId: string,
  ): Promise<BackendProjectImageGenerationHistoryRecord[]>;
}

export interface BackendPlatformRoleRepository {
  listRolesForUser(userId: string): Promise<BackendPlatformRoleRecord[]>;
}

export interface BackendAnalyticsEventRepository {
  appendEvent(record: BackendAnalyticsEventRecord): Promise<BackendAnalyticsEventRecord>;
}

export interface BackendAuditLogRepository {
  appendAuditRecord(record: BackendAuditLogRecord): Promise<BackendAuditLogRecord>;
}

export interface BackendProviderKeyRepository {
  getByProviderKeyId(
    providerKeyId: string,
  ): Promise<BackendProviderKeyRecord | undefined>;
  getActiveValidatedProviderKeyForWorkspaceProvider?(
    workspaceId: string,
    providerId: BackendSupportedProviderId,
  ): Promise<BackendProviderKeyRecord | undefined>;
  listForWorkspace(workspaceId: string): Promise<BackendProviderKeyRecord[]>;
  listRedactedConnectionSummariesForWorkspace?(
    workspaceId: string,
  ): Promise<BackendRedactedProviderConnectionSummary[]>;
  createProviderKey(
    input: BackendProviderKeyCreateInput,
  ): Promise<BackendProviderKeyStorageResult>;
  replaceProviderKey(
    input: BackendProviderKeyReplaceInput,
  ): Promise<BackendProviderKeyStorageResult>;
  revokeProviderKey(
    input: BackendProviderKeyRevokeInput,
  ): Promise<BackendProviderKeyStorageResult>;
  updateProviderKeyValidationState?(
    input: BackendProviderKeyValidationStateInput,
  ): Promise<BackendProviderKeyValidationStateResult>;
}

export interface BackendCreditLedgerRepository {
  recordEntry(
    mutation: BackendCreditLedgerMutationInput,
  ): Promise<BackendWorkspaceCreditLedgerEntry>;
  listForWorkspace(
    workspaceId: string,
  ): Promise<BackendWorkspaceCreditLedgerEntry[]>;
}

export interface BackendArtifactRecordRepository {
  getArtifactRecord(
    workspaceId: string,
    jobId: string,
    artifactId: string,
  ): Promise<BackendArtifactRecord | undefined>;
  listArtifactRecordsForJob(
    workspaceId: string,
    jobId: string,
  ): Promise<BackendArtifactRecord[]>;
}

export interface BackendArtifactStorageRefRepository {
  getStorageRef(
    workspaceId: string,
    jobId: string,
    artifactId: string,
  ): Promise<BackendArtifactStorageRefRecord | undefined>;
  getAccessReadiness(
    workspaceId: string,
    jobId: string,
    artifactId: string,
  ): Promise<BackendArtifactAccessReadinessRecord | undefined>;
}
