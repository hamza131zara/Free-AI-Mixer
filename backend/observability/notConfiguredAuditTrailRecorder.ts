import type { SafeAuditTrailEntry } from "./auditTrailContracts";
import { resolveAuditTrailTaxonomy } from "./auditTrailContracts";
import type {
  AuditTrailRecorder,
  AuditTrailRecorderReadiness,
  AuditTrailRecordResult,
} from "./auditTrailRecorder";
import { sanitizeSafeEventMetadata } from "./safeEventSanitizer";

const readiness: AuditTrailRecorderReadiness = {
  kind: "audit_trail_not_configured",
  persistenceEnabled: false,
  liveRecordingEnabled: false,
  appendOnlyLater: true,
  message:
    "Audit trail persistence is not configured in this product phase. No audit records are written.",
};

export const createNotConfiguredAuditTrailRecorder =
  (): AuditTrailRecorder => ({
    getReadiness: () => readiness,
    getTaxonomy: () => resolveAuditTrailTaxonomy(),
    async record(entry: SafeAuditTrailEntry): Promise<AuditTrailRecordResult> {
      const sanitization = sanitizeSafeEventMetadata(entry.metadata);

      if (sanitization.rejected) {
        return {
          kind: "rejected",
          persisted: false,
          reason: "unsafe_fields_detected",
          message:
            "Unsafe audit metadata was rejected. Audit persistence remains fail closed until a safe recorder is configured.",
          rejectedFields: sanitization.unsafeFieldPaths,
        };
      }

      return {
        kind: "not_recorded",
        persisted: false,
        reason: "not_configured",
        message: readiness.message,
      };
    },
  });
