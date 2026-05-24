import type {
  EventLogTaxonomySummary,
  SafeEventEnvelope,
} from "./eventLogContracts";

export interface EventRecorderReadiness {
  kind: "event_recorder_not_configured";
  persistenceEnabled: false;
  liveRecordingEnabled: false;
  message: string;
}

export type EventRecordResult =
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

export interface EventRecorder {
  getReadiness(): EventRecorderReadiness;
  getTaxonomy(): EventLogTaxonomySummary;
  record(event: SafeEventEnvelope): Promise<EventRecordResult>;
}
