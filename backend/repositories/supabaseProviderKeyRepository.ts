import { randomUUID } from "node:crypto";
import type {
  BackendProviderKeyCreateInput,
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyReplaceInput,
  BackendProviderKeyRevokeInput,
  BackendProviderKeyValidationStateInput,
  BackendProviderKeyValidationStateResult,
  BackendProviderKeyStatus,
  BackendProviderKeyStorageResult,
  BackendProviderKeyVerificationStatus,
} from "./repositoryContracts";
import type {
  BackendProviderConnectionStatus,
  BackendProviderValidationStatus,
  BackendRedactedProviderConnectionSummary,
  BackendSupportedProviderId,
} from "../contracts/providerSettingsHttpTypes";

export interface ProviderKeysTableQueryResult<Row> {
  data: Row[] | Row | null;
  error: { code?: string | null; message: string } | null;
}

export interface ProviderKeysTableQuery<Row> {
  select(columns: string): ProviderKeysTableQuery<Row>;
  eq(
    column: string,
    value: string | number | boolean | null,
  ): ProviderKeysTableQuery<Row>;
  is(column: string, value: null): ProviderKeysTableQuery<Row>;
  insert(values: Partial<Row>): ProviderKeysTableQuery<Row>;
  update(values: Partial<Row>): ProviderKeysTableQuery<Row>;
  maybeSingle(): Promise<ProviderKeysTableQueryResult<Row>>;
  then<TResult1 = ProviderKeysTableQueryResult<Row>, TResult2 = never>(
    onfulfilled?:
      | ((value: ProviderKeysTableQueryResult<Row>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
}

export interface SupabaseProviderKeyClient {
  from(table: "provider_keys"): ProviderKeysTableQuery<ProviderKeyRow>;
}

export interface ProviderKeyRow {
  provider_key_id: string;
  workspace_id: string;
  owner_id: string;
  provider_id: string | null;
  provider_name: string;
  encrypted_payload: string | null;
  secret_ref: string | null;
  storage_mode: "encrypted_payload" | "external_secret_ref";
  key_version: string | number;
  encryption_algorithm: string;
  algorithm: string | null;
  key_fingerprint_suffix?: string | null;
  masked_fingerprint?: string | null;
  status: BackendProviderKeyStatus;
  verification_status: BackendProviderKeyVerificationStatus | null;
  last_verified_at: string | null;
  last_verification_error_code: string | null;
  needs_reverification: boolean;
  created_by_user_id: string;
  updated_by_user_id: string | null;
  rotated_at: string | null;
  revoked_at: string | null;
  disabled_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

const supportedProviderIds: ReadonlySet<BackendSupportedProviderId> = new Set([
  "openai",
  "runway",
  "luma",
  "google",
  "stability",
  "replicate",
]);

const providerKeySelectColumns = [
  "provider_key_id",
  "workspace_id",
  "owner_id",
  "provider_id",
  "provider_name",
  "encrypted_payload",
  "secret_ref",
  "storage_mode",
  "key_version",
  "encryption_algorithm",
  "algorithm",
  "status",
  "verification_status",
  "last_verified_at",
  "last_verification_error_code",
  "needs_reverification",
  "created_by_user_id",
  "updated_by_user_id",
  "rotated_at",
  "revoked_at",
  "disabled_at",
  "deleted_at",
  "created_at",
  "updated_at",
].join(", ");

const providerKeyRedactedSummarySelectColumns = [
  "provider_key_id",
  "workspace_id",
  "owner_id",
  "provider_id",
  "provider_name",
  "storage_mode",
  "key_version",
  "encryption_algorithm",
  "algorithm",
  "status",
  "verification_status",
  "last_verified_at",
  "last_verification_error_code",
  "needs_reverification",
  "created_by_user_id",
  "updated_by_user_id",
  "rotated_at",
  "revoked_at",
  "disabled_at",
  "deleted_at",
  "created_at",
  "updated_at",
].join(", ");

const isUniqueConstraintViolation = (
  error: ProviderKeysTableQueryResult<ProviderKeyRow>["error"],
): boolean => {
  if (!error) {
    return false;
  }

  const normalized = error.message.toLowerCase();
  return (
    error.code === "23505" ||
    normalized.includes("duplicate key") ||
    normalized.includes("unique constraint") ||
    normalized.includes("already exists")
  );
};

const isLegacyIntegerKeyVersionViolation = (
  error: ProviderKeysTableQueryResult<ProviderKeyRow>["error"],
): boolean => {
  if (!error) {
    return false;
  }

  const normalized = error.message.toLowerCase();
  return (
    normalized.includes("key_version") &&
    (normalized.includes("integer") ||
      normalized.includes("invalid input syntax for type integer"))
  );
};

const isMissingFingerprintColumnViolation = (
  error: ProviderKeysTableQueryResult<ProviderKeyRow>["error"],
): boolean => {
  if (!error) {
    return false;
  }

  const normalized = error.message.toLowerCase();
  return (
    error.code === "42703" ||
    (normalized.includes("column") &&
      (normalized.includes("key_fingerprint_suffix") ||
        normalized.includes("masked_fingerprint"))) ||
    (normalized.includes("could not find") &&
      (normalized.includes("key_fingerprint_suffix") ||
        normalized.includes("masked_fingerprint")))
  );
};

const getLegacyIntegerKeyVersion = (
  keyVersion: string | number,
): number | undefined => {
  if (typeof keyVersion === "number") {
    return Number.isInteger(keyVersion) ? keyVersion : undefined;
  }

  const match = keyVersion.match(/^v(\d+)$/i);

  if (!match) {
    return undefined;
  }

  return Number.parseInt(match[1], 10);
};

const isSupportedProviderId = (
  providerId: string,
): providerId is BackendSupportedProviderId =>
  supportedProviderIds.has(providerId as BackendSupportedProviderId);

const verificationStatusToPublicStatus = (
  status: BackendProviderKeyVerificationStatus | null,
): BackendProviderValidationStatus => {
  if (status === "validated") {
    return "validated";
  }

  if (status === "validation_failed") {
    return "validation_failed";
  }

  if (status === "needs_reverification") {
    return "validation_unavailable";
  }

  return "not_validated";
};

const toBackendProviderKeyRecord = (
  row: ProviderKeyRow,
): BackendProviderKeyRecord => ({
  providerKeyId: row.provider_key_id,
  providerName: row.provider_name,
  workspaceId: row.workspace_id,
  ownerId: row.owner_id,
  createdByUserId: row.created_by_user_id,
  storageMode: row.storage_mode,
  ...(row.encrypted_payload
    ? {
        encryptedSecret: {
          encryptedPayload: row.encrypted_payload,
          keyVersion: String(row.key_version),
          algorithm: row.encryption_algorithm || row.algorithm || "unknown",
        },
      }
    : {}),
  ...(row.secret_ref ? { secretRef: row.secret_ref } : {}),
  status: row.status,
  ...(row.last_verified_at ? { lastVerifiedAt: row.last_verified_at } : {}),
  ...(row.last_verification_error_code
    ? { lastVerificationErrorCode: row.last_verification_error_code }
    : {}),
  verificationStatus: row.verification_status ?? "not_validated",
  needsReverification: row.needs_reverification,
  ...(row.rotated_at ? { rotatedAt: row.rotated_at } : {}),
  ...(row.revoked_at ? { revokedAt: row.revoked_at } : {}),
  ...(row.disabled_at ? { disabledAt: row.disabled_at } : {}),
  ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
  ...(row.updated_by_user_id ? { updatedByUserId: row.updated_by_user_id } : {}),
});

const toRedactedConnectionSummary = (
  row: ProviderKeyRow,
  status: BackendProviderConnectionStatus = "stored",
): BackendRedactedProviderConnectionSummary => {
  const providerId = row.provider_id ?? row.provider_name;

  if (!isSupportedProviderId(providerId)) {
    return {
      providerId: "openai",
      status: "unavailable",
      maskedKeySummary: "Unsupported provider metadata could not be summarized safely.",
      lastValidationStatus: "validation_unavailable",
      verificationStatus: "validation_unavailable",
      needsReverification: true,
      canManage: false,
      unavailableReason: "secure_provider_key_storage_not_enabled",
    };
  }

  const verificationStatus = verificationStatusToPublicStatus(row.verification_status);
  const suffix = row.provider_key_id.slice(-4);

  return {
    providerId,
    status,
    maskedKeySummary:
      status === "stored" || status === "not_connected"
        ? `Provider key metadata is stored server-side only; record ending ${suffix}.`
        : "Provider key storage metadata is unavailable.",
    maskedFingerprint: `provider-key:${suffix}`,
    keyFingerprintSuffix: suffix,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.last_verified_at ? { lastVerifiedAt: row.last_verified_at } : {}),
    lastValidationStatus: verificationStatus,
    verificationStatus,
    needsReverification: row.needs_reverification,
    canManage: true,
  };
};

const getSingleRow = async (
  query: ProviderKeysTableQuery<ProviderKeyRow>,
): Promise<ProviderKeyRow | undefined> => {
  const result = await query.maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data || Array.isArray(result.data)) {
    return undefined;
  }

  return result.data;
};

const getManyRows = async (
  query: ProviderKeysTableQuery<ProviderKeyRow>,
): Promise<ProviderKeyRow[]> => {
  const result = await query;

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    return [];
  }

  return Array.isArray(result.data) ? result.data : [result.data];
};

const nowIso = (): string => new Date().toISOString();

const hasStorageHandle = (
  input:
    | BackendProviderKeyCreateInput
    | BackendProviderKeyReplaceInput,
): boolean => Boolean(input.encryptedSecret || input.secretRef);

const toStorageUnavailableResult = (): BackendProviderKeyStorageResult => ({
  kind: "vault_unavailable",
  status: "vault_unavailable",
  message:
    "Provider key storage handle is unavailable. A configured backend vault is required before storage can be live.",
});

const toProviderKeyRow = (input: {
  createdByUserId: string;
  encryptedSecret?: BackendProviderKeyCreateInput["encryptedSecret"];
  ownerId: string;
  providerId: BackendSupportedProviderId;
  providerKeyId?: string;
  secretRef?: string;
  keyFingerprintSuffix?: string;
  maskedFingerprint?: string;
  workspaceId: string;
}): ProviderKeyRow => {
  const timestamp = nowIso();
  const storageMode = input.secretRef ? "external_secret_ref" : "encrypted_payload";
  const keyVersion = input.encryptedSecret?.keyVersion ?? "external-ref-v1";
  const algorithm =
    input.encryptedSecret?.algorithm ??
    (input.secretRef ? "external_secret_manager" : "unknown");

  return {
    provider_key_id: input.providerKeyId ?? randomUUID(),
    workspace_id: input.workspaceId,
    owner_id: input.ownerId,
    provider_id: input.providerId,
    provider_name: input.providerId,
    encrypted_payload: input.encryptedSecret?.encryptedPayload ?? null,
    secret_ref: input.secretRef ?? null,
    storage_mode: storageMode,
    key_version: keyVersion,
    encryption_algorithm: algorithm,
    algorithm,
    key_fingerprint_suffix: input.keyFingerprintSuffix ?? null,
    masked_fingerprint: input.maskedFingerprint ?? null,
    status: "active",
    verification_status: "not_validated",
    last_verified_at: null,
    last_verification_error_code: null,
    needs_reverification: true,
    created_by_user_id: input.createdByUserId,
    updated_by_user_id: input.createdByUserId,
    rotated_at: null,
    revoked_at: null,
    disabled_at: null,
    deleted_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
};

const withoutFingerprintColumns = (row: ProviderKeyRow): ProviderKeyRow => {
  const { key_fingerprint_suffix: _keyFingerprintSuffix, masked_fingerprint: _maskedFingerprint, ...rest } = row;
  return rest;
};

const withLegacyIntegerKeyVersion = (
  row: ProviderKeyRow,
): ProviderKeyRow | undefined => {
  const legacyIntegerKeyVersion = getLegacyIntegerKeyVersion(row.key_version);

  if (legacyIntegerKeyVersion === undefined) {
    return undefined;
  }

  return {
    ...row,
    key_version: legacyIntegerKeyVersion,
  };
};

const insertProviderKeyRow = async (
  client: SupabaseProviderKeyClient,
  row: ProviderKeyRow,
): Promise<{
  insertedRow: ProviderKeyRow;
  result: ProviderKeysTableQueryResult<ProviderKeyRow>;
}> => {
  const attemptedRows: ProviderKeyRow[] = [];
  const enqueueCandidate = (candidate: ProviderKeyRow | undefined): void => {
    if (!candidate) {
      return;
    }

    const serialized = JSON.stringify(candidate);

    if (attemptedRows.some((attempted) => JSON.stringify(attempted) === serialized)) {
      return;
    }

    attemptedRows.push(candidate);
  };

  enqueueCandidate(row);
  enqueueCandidate(withLegacyIntegerKeyVersion(row));
  enqueueCandidate(withoutFingerprintColumns(row));
  enqueueCandidate(withLegacyIntegerKeyVersion(withoutFingerprintColumns(row)));

  let lastResult: ProviderKeysTableQueryResult<ProviderKeyRow> | undefined;

  for (const candidate of attemptedRows) {
    const result = await client
      .from("provider_keys")
      .insert(candidate)
      .select(providerKeySelectColumns)
      .maybeSingle();

    if (!result.error) {
      return {
        insertedRow: candidate,
        result,
      };
    }

    lastResult = result;

    if (
      !isLegacyIntegerKeyVersionViolation(result.error) &&
      !isMissingFingerprintColumnViolation(result.error)
    ) {
      break;
    }
  }

  return {
    insertedRow: row,
    result:
      lastResult ?? {
        data: null,
        error: {
          message: "Provider key row insert did not execute.",
        },
      },
  };
};

export class SupabaseProviderKeyRepository
  implements BackendProviderKeyRepository
{
  constructor(private readonly client: SupabaseProviderKeyClient) {}

  async getByProviderKeyId(
    providerKeyId: string,
  ): Promise<BackendProviderKeyRecord | undefined> {
    const row = await getSingleRow(
      this.client
        .from("provider_keys")
        .select(providerKeySelectColumns)
        .eq("provider_key_id", providerKeyId),
    );

    return row ? toBackendProviderKeyRecord(row) : undefined;
  }

  async listForWorkspace(
    workspaceId: string,
  ): Promise<BackendProviderKeyRecord[]> {
    const rows = await getManyRows(
      this.client
        .from("provider_keys")
        .select(providerKeySelectColumns)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null),
    );

    return rows.map(toBackendProviderKeyRecord);
  }

  async listRedactedConnectionSummariesForWorkspace(
    workspaceId: string,
  ): Promise<BackendRedactedProviderConnectionSummary[]> {
    const rows = await getManyRows(
      this.client
        .from("provider_keys")
        .select(providerKeyRedactedSummarySelectColumns)
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .is("deleted_at", null),
    );

    return rows.map((row) => toRedactedConnectionSummary(row));
  }

  async createProviderKey(
    input: BackendProviderKeyCreateInput,
  ): Promise<BackendProviderKeyStorageResult> {
    if (!isSupportedProviderId(input.providerId)) {
      return {
        kind: "invalid_provider",
        status: "invalid_provider",
        message: "Unsupported provider.",
      };
    }

    if (!hasStorageHandle(input)) {
      return toStorageUnavailableResult();
    }

    const existing = await getSingleRow(
      this.client
        .from("provider_keys")
        .select(providerKeySelectColumns)
        .eq("workspace_id", input.workspaceId)
        .eq("provider_name", input.providerId)
        .eq("status", "active")
        .is("deleted_at", null),
    );

    if (existing) {
      return {
        kind: "conflict",
        status: "conflict",
        code: "active_provider_key_exists",
        message: "An active provider key already exists for this workspace/provider.",
      };
    }

    const row = toProviderKeyRow({
      createdByUserId: input.createdByUserId,
      encryptedSecret: input.encryptedSecret,
      keyFingerprintSuffix: input.keyFingerprintSuffix,
      maskedFingerprint: input.maskedFingerprint,
      ownerId: input.ownerId,
      providerId: input.providerId,
      secretRef: input.secretRef,
      workspaceId: input.workspaceId,
    });

    const { insertedRow, result } = await insertProviderKeyRow(this.client, row);

    if (result.error) {
      if (isUniqueConstraintViolation(result.error)) {
        return {
          kind: "conflict",
          status: "conflict",
          code: "active_provider_key_exists",
          message: "An active provider key already exists for this workspace/provider.",
        };
      }

      throw new Error(result.error.message);
    }

    const storedRow =
      result.data && !Array.isArray(result.data) ? result.data : insertedRow;

    return {
      kind: "stored",
      status: "stored",
      connection: toRedactedConnectionSummary(storedRow),
    };
  }

  async replaceProviderKey(
    input: BackendProviderKeyReplaceInput,
  ): Promise<BackendProviderKeyStorageResult> {
    if (!isSupportedProviderId(input.providerId)) {
      return {
        kind: "invalid_provider",
        status: "invalid_provider",
        message: "Unsupported provider.",
      };
    }

    if (!hasStorageHandle(input)) {
      return toStorageUnavailableResult();
    }

    const existing = await getSingleRow(
      this.client
        .from("provider_keys")
        .select(providerKeySelectColumns)
        .eq("provider_key_id", input.providerKeyId)
        .eq("workspace_id", input.workspaceId)
        .eq("status", "active")
        .is("deleted_at", null),
    );

    if (!existing) {
      return {
        kind: "unauthorized",
        status: "unauthorized",
        code: "workspace_permission_not_verified",
        message: "Active provider key record was not found for this workspace.",
      };
    }

    const timestamp = nowIso();
    const rotated = await this.client
      .from("provider_keys")
      .update({
        status: "rotated",
        rotated_at: timestamp,
        updated_at: timestamp,
        updated_by_user_id: input.requesterUserId,
      })
      .eq("provider_key_id", input.providerKeyId)
      .eq("workspace_id", input.workspaceId)
      .eq("status", "active")
      .select(providerKeySelectColumns)
      .maybeSingle();

    if (rotated.error) {
      throw new Error(rotated.error.message);
    }

    const replacementRow = toProviderKeyRow({
      createdByUserId: input.requesterUserId,
      encryptedSecret: input.encryptedSecret,
      keyFingerprintSuffix: input.keyFingerprintSuffix,
      maskedFingerprint: input.maskedFingerprint,
      ownerId: existing.owner_id,
      providerId: input.providerId,
      secretRef: input.secretRef,
      workspaceId: input.workspaceId,
    });

    const { insertedRow, result } = await insertProviderKeyRow(
      this.client,
      replacementRow,
    );

    if (result.error) {
      if (isUniqueConstraintViolation(result.error)) {
        return {
          kind: "conflict",
          status: "conflict",
          code: "record_version_conflict",
          message:
            "Provider key replacement could not be completed because the active record changed.",
        };
      }

      throw new Error(result.error.message);
    }

    const storedRow =
      result.data && !Array.isArray(result.data) ? result.data : insertedRow;

    return {
      kind: "replaced",
      status: "replaced",
      connection: toRedactedConnectionSummary(storedRow),
    };
  }

  async revokeProviderKey(
    input: BackendProviderKeyRevokeInput,
  ): Promise<BackendProviderKeyStorageResult> {
    const timestamp = nowIso();
    const result = await this.client
      .from("provider_keys")
      .update({
        status: "disabled",
        disabled_at: timestamp,
        revoked_at: timestamp,
        updated_at: timestamp,
        updated_by_user_id: input.requesterUserId,
      })
      .eq("provider_key_id", input.providerKeyId)
      .eq("workspace_id", input.workspaceId)
      .eq("status", "active")
      .is("deleted_at", null)
      .select(providerKeySelectColumns)
      .maybeSingle();

    if (result.error) {
      throw new Error(result.error.message);
    }

    if (!result.data || Array.isArray(result.data)) {
      return {
        kind: "unauthorized",
        status: "unauthorized",
        code: "workspace_permission_not_verified",
        message: "Active provider key record was not found for this workspace.",
      };
    }

    return {
      kind: "revoked",
      status: "revoked",
      connection: {
        ...toRedactedConnectionSummary(result.data),
        status: "not_connected",
        maskedFingerprint: undefined,
        keyFingerprintSuffix: undefined,
        maskedKeySummary: "Provider key was revoked server-side.",
        verificationStatus: "not_validated",
        lastValidationStatus: "not_validated",
        needsReverification: true,
      },
    };
  }

  async updateProviderKeyValidationState(
    input: BackendProviderKeyValidationStateInput,
  ): Promise<BackendProviderKeyValidationStateResult> {
    const result = await this.client
      .from("provider_keys")
      .update({
        last_verification_error_code:
          input.verificationStatus === "validated"
            ? null
            : input.lastVerificationErrorCode ?? "validation_unavailable",
        last_verified_at:
          input.verificationStatus === "validated"
            ? input.lastVerifiedAt ?? nowIso()
            : null,
        needs_reverification: input.needsReverification,
        updated_at: nowIso(),
        updated_by_user_id: input.requesterUserId,
        verification_status: input.verificationStatus,
      })
      .eq("provider_key_id", input.providerKeyId)
      .eq("workspace_id", input.workspaceId)
      .eq("status", "active")
      .is("deleted_at", null)
      .select(providerKeySelectColumns)
      .maybeSingle();

    if (result.error) {
      throw new Error(result.error.message);
    }

    if (!result.data || Array.isArray(result.data)) {
      return {
        kind: "validation_state_not_found",
        status: "not_found",
        message: "Active provider key record was not found for this workspace.",
      };
    }

    return {
      kind: "validation_state_updated",
      status: "updated",
      connection: toRedactedConnectionSummary(result.data),
    };
  }
}

export const createSupabaseProviderKeyRepository = (
  client: SupabaseProviderKeyClient,
): BackendProviderKeyRepository => new SupabaseProviderKeyRepository(client);
