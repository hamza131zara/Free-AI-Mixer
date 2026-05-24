export type SafeStructuredLogSeverity = "info" | "warn" | "error";
import { sanitizeSafeEventMetadata } from "./safeEventSanitizer";

export interface SafeStructuredLogEventInput {
  event: string;
  severity: SafeStructuredLogSeverity;
  correlationId?: string;
  jobId?: string;
  reasonCode?: string;
  metadata?: Record<string, unknown>;
}

export interface SafeStructuredLogEvent {
  event: string;
  severity: SafeStructuredLogSeverity;
  timestamp: string;
  correlationId?: string;
  jobId?: string;
  reasonCode?: string;
  metadata: Record<string, unknown>;
  redactedFields: string[];
}

export const createSafeStructuredLogEvent = ({
  event,
  severity,
  correlationId,
  jobId,
  reasonCode,
  metadata = {},
}: SafeStructuredLogEventInput): SafeStructuredLogEvent => {
  const sanitized = sanitizeSafeEventMetadata(metadata);

  return {
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...(correlationId ? { correlationId } : {}),
    ...(jobId ? { jobId } : {}),
    ...(reasonCode ? { reasonCode } : {}),
    metadata: sanitized.sanitizedMetadata,
    redactedFields: sanitized.redactedFields,
  };
};
