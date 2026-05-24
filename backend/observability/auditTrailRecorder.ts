import type {
  AuditTrailTaxonomySummary,
  SafeAuditTrailEntry,
} from "./auditTrailContracts";

export interface AuditTrailRecorderReadiness {
  kind: "audit_trail_not_configured";
  persistenceEnabled: false;
  liveRecordingEnabled: false;
  appendOnlyLater: true;
  message: string;
}

export type AuditTrailRecordResult =
  | {
      kind: "not_recorded";
      persisted: false;
      reason: "not_configured";
      message: string;
    }
  | {
      kind: "rejected";
      persisted: false;
      reason: "unsafe_fields_detected";
      message: string;
      rejectedFields: string[];
    };

export interface AuditTrailRecorder {
  getReadiness(): AuditTrailRecorderReadiness;
  getTaxonomy(): AuditTrailTaxonomySummary;
  record(entry: SafeAuditTrailEntry): Promise<AuditTrailRecordResult>;
}
