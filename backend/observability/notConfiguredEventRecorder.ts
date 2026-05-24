import type { SafeEventEnvelope } from "./eventLogContracts";
import { resolveEventLogTaxonomy } from "./eventLogContracts";
import type {
  EventRecorder,
  EventRecorderReadiness,
  EventRecordResult,
} from "./eventRecorder";
import { sanitizeSafeEventMetadata } from "./safeEventSanitizer";

const readiness: EventRecorderReadiness = {
  kind: "event_recorder_not_configured",
  persistenceEnabled: false,
  liveRecordingEnabled: false,
  message:
    "Event logging is not configured in this product phase. No analytics or operational events are persisted.",
};

export const createNotConfiguredEventRecorder = (): EventRecorder => ({
  getReadiness: () => readiness,
  getTaxonomy: () => resolveEventLogTaxonomy(),
  async record(event: SafeEventEnvelope): Promise<EventRecordResult> {
    const sanitization = sanitizeSafeEventMetadata(event.metadata);

    if (sanitization.rejected) {
      return {
        kind: "rejected",
        persisted: false,
        reason: "unsafe_fields_detected",
        message:
          "Unsafe event metadata was rejected. Event logging remains fail closed until a safe recorder is configured.",
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
