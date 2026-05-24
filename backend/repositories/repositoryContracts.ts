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

export type BackendProviderKeyStatus = "active" | "rotated" | "disabled";
export type BackendProviderKeyVerificationStatus =
  | "not_validated"
  | "validated"
  | "validation_failed"
  | "needs_reverification";

export interface BackendEncryptedSecretPayload {
  encryptedPayload: string;
  keyVersion: string;
  algorithm: string;
}

export interface BackendProviderKeyRecord
  extends BackendWorkspaceProviderKeyOwnership {
  encryptedSecret: BackendEncryptedSecretPayload;
  status: BackendProviderKeyStatus;
  maskedFingerprint?: string;
  keyFingerprintSuffix?: string;
  lastVerifiedAt?: string;
  verificationStatus?: BackendProviderKeyVerificationStatus;
  needsReverification?: boolean;
  rotatedAt?: string;
  disabledAt?: string;
}

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

export interface BackendUserAccountRepository {
  getByUserId(userId: string): Promise<BackendUserAccountRecord | undefined>;
  getByAuthSubject(
    authProvider: BackendUserAccountIdentity["authProvider"],
    authSubject: string,
  ): Promise<BackendUserAccountRecord | undefined>;
}

export interface BackendWorkspaceRepository {
  getByWorkspaceId(
    workspaceId: string,
  ): Promise<BackendWorkspaceRecord | undefined>;
  listForUser(userId: string): Promise<BackendWorkspaceRecord[]>;
}

export interface BackendWorkspaceMembershipRepository {
  getMembership(
    workspaceId: string,
    userId: string,
  ): Promise<BackendWorkspaceMembershipRecord | undefined>;
  listMembershipsForWorkspace(
    workspaceId: string,
  ): Promise<BackendWorkspaceMembershipRecord[]>;
}

export interface BackendPlatformRoleRepository {
  listRolesForUser(userId: string): Promise<BackendPlatformRoleRecord[]>;
}

export interface BackendProviderKeyRepository {
  getByProviderKeyId(
    providerKeyId: string,
  ): Promise<BackendProviderKeyRecord | undefined>;
  listForWorkspace(workspaceId: string): Promise<BackendProviderKeyRecord[]>;
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
