import type {
  BackendExportJobRecord,
  BackendExportLifecycleStatus,
} from "../contracts/exportHttpTypes";

export interface RecoveryOptions {
  currentTimeMs?: number;
}

const isTerminalStatus = (status: BackendExportLifecycleStatus): boolean =>
  status === "success" || status === "error" || status === "expired";

const isRecoverableStatus = (status: BackendExportLifecycleStatus): boolean =>
  status === "submitted" || status === "rendering" || status === "finalizing";

// Valid in-flight statuses for backend rendering
const validInFlightStatuses = new Set<BackendExportLifecycleStatus>([
  "submitted",
  "rendering",
  "finalizing",
]);

const isValidInFlightStatus = (status: BackendExportLifecycleStatus): boolean =>
  validInFlightStatuses.has(status);

export interface RecoveredExportJobRecord {
  record: BackendExportJobRecord;
  recovered: boolean;
  reason: string;
}

/**
 * Recovery policy for export job records.
 *
 * This module defines how persisted export job records should be recovered
 * after a server restart, without modifying the original records or
 * performing any I/O operations.
 *
 * Recovery rules:
 * - submitted stays submitted
 * - rendering maps to submitted (claim expired - worker died)
 * - finalizing maps to submitted (claim expired - worker died)
 * - success stays success
 * - error stays error
 * - expired stays expired
 * - claimedByWorkerId cleared for recovered non-terminal jobs
 * - claimExpiresAt cleared for recovered non-terminal jobs
 * - attemptCount preserved
 * - requestId/jobId/timelineId/renderSettings preserved
 * - artifact metadata preserved (already safe)
 * - failure.details never introduced
 */
export const recoverExportJobRecord = (
  record: BackendExportJobRecord,
  options?: RecoveryOptions,
): RecoveredExportJobRecord => {
  const currentTime = options?.currentTimeMs ?? Date.now();

  // Terminal statuses remain unchanged
  if (record.status === "success") {
    return {
      record,
      recovered: false,
      reason: "terminal status unchanged",
    };
  }

  if (record.status === "error") {
    return {
      record,
      recovered: false,
      reason: "terminal status unchanged",
    };
  }

  if (record.status === "expired") {
    return {
      record,
      recovered: false,
      reason: "terminal status unchanged",
    };
  }

  // Non-terminal statuses need recovery to submitted
  if (record.status === "submitted") {
    return {
      record,
      recovered: false,
      reason: "already in recoverable state",
    };
  }

  // rendering/finalizing: worker died, re-queue as submitted
  if (record.status === "rendering" || record.status === "finalizing") {
    const recovered: BackendExportJobRecord = {
      ...record,
      status: "submitted",
      // Clear worker claim - worker that held claim is dead
      claimedByWorkerId: undefined,
      claimExpiresAt: undefined,
      // Keep historical timestamps for debugging
      // renderingAt/finalizingAt remain as historical record
    };

    return {
      record: recovered,
      recovered: true,
      reason: `${record.status} -> submitted (claim expired)`,
    };
  }

  // Fallback for unknown statuses - return as-is
  return {
    record,
    recovered: false,
    reason: "unknown status, returned as-is",
  };
};

/**
 * Recovery policy for a batch of export job records.
 * Applies recovery rules to each record independently.
 */
export const recoverExportJobRecords = (
  records: BackendExportJobRecord[],
  options?: RecoveryOptions,
): RecoveredExportJobRecord[] => {
  return records.map((record) => recoverExportJobRecord(record, options));
};

/**
 * Filter for records that would be recovered (non-terminal jobs).
 */
export const getRecoverableRecords = (
  records: BackendExportJobRecord[],
): BackendExportJobRecord[] => {
  return records.filter((record) => isRecoverableStatus(record.status));
};

/**
 * Filter for records that would remain unchanged (terminal jobs).
 */
export const getTerminalRecords = (
  records: BackendExportJobRecord[],
): BackendExportJobRecord[] => {
  return records.filter((record) => isTerminalStatus(record.status));
};