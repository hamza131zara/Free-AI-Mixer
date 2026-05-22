export type StructuredLogLevel = "info" | "warn" | "error";

export interface StructuredLogEventInput {
  level: StructuredLogLevel;
  event: string;
  message?: string;
  fields?: Record<string, unknown>;
}

export interface StructuredLogEvent {
  level: StructuredLogLevel;
  event: string;
  message?: string;
  fields: Record<string, unknown>;
  redactedFields: string[];
  safeToEmit: true;
}

export type ProductionObservabilityMissingItem =
  | "structured_logs"
  | "backend_error_mapping"
  | "render_export_failure_visibility"
  | "download_failure_visibility"
  | "monitoring_plan"
  | "sensitive_data_redaction";

export type ProductionObservabilityReadinessDecision =
  | {
      kind: "ready";
      missingItems: [];
      sensitiveDataAllowedInLogs: false;
      publicLaunchEnabled: false;
    }
  | {
      kind: "not_ready";
      missingItems: ProductionObservabilityMissingItem[];
      sensitiveDataAllowedInLogs: false;
      publicLaunchEnabled: false;
    };

export interface ProductionObservabilityReadinessInput {
  monitoringDocsText?: string;
  backendErrorMappingSource?: string;
  renderFailureSource?: string;
  downloadFailureSource?: string;
}

const sensitiveKeyParts = [
  "authorization",
  "cookie",
  "token",
  "secret",
  "password",
  "private_key",
  "privatekey",
  "service_role",
  "signedurl",
  "signed_url",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSensitiveKey = (key: string): boolean => {
  const normalized = key.toLowerCase();
  return sensitiveKeyParts.some((part) => normalized.includes(part));
};

const sanitizeValue = (value: unknown, redactedFields: string[], path: string): unknown => {
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(item, redactedFields, `${path}[${index}]`));
  }

  if (!isRecord(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    const fieldPath = path ? `${path}.${key}` : key;

    if (isSensitiveKey(key)) {
      sanitized[key] = "[redacted]";
      redactedFields.push(fieldPath);
      continue;
    }

    sanitized[key] = sanitizeValue(nestedValue, redactedFields, fieldPath);
  }

  return sanitized;
};

export const createStructuredLogEvent = ({
  level,
  event,
  message,
  fields = {},
}: StructuredLogEventInput): StructuredLogEvent => {
  const redactedFields: string[] = [];
  const sanitizedFields = sanitizeValue(fields, redactedFields, "");

  return {
    level,
    event,
    ...(message ? { message } : {}),
    fields: isRecord(sanitizedFields) ? sanitizedFields : {},
    redactedFields,
    safeToEmit: true,
  };
};

const hasAll = (source: string | undefined, tokens: string[]): boolean =>
  tokens.every((token) => source?.includes(token));

export const resolveProductionObservabilityReadiness = ({
  monitoringDocsText,
  backendErrorMappingSource,
  renderFailureSource,
  downloadFailureSource,
}: ProductionObservabilityReadinessInput): ProductionObservabilityReadinessDecision => {
  const missingItems: ProductionObservabilityMissingItem[] = [];

  if (!hasAll(monitoringDocsText, ["Structured logs", "No sensitive data in logs"])) {
    missingItems.push("structured_logs");
  }

  if (!hasAll(backendErrorMappingSource, ["invalid_export_request", "internal_export_error"])) {
    missingItems.push("backend_error_mapping");
  }

  if (!hasAll(renderFailureSource, ["failure", "renderer"])) {
    missingItems.push("render_export_failure_visibility");
  }

  if (!hasAll(downloadFailureSource, ["transport_error", "descriptor_expired", "invalid_navigation_target"])) {
    missingItems.push("download_failure_visibility");
  }

  if (!hasAll(monitoringDocsText, ["Monitoring plan", "Render/export failure visibility", "Download failure visibility"])) {
    missingItems.push("monitoring_plan");
  }

  if (!hasAll(monitoringDocsText, ["No sensitive data in logs", "redact"])) {
    missingItems.push("sensitive_data_redaction");
  }

  const base = {
    sensitiveDataAllowedInLogs: false as const,
    publicLaunchEnabled: false as const,
  };

  return missingItems.length === 0
    ? {
        kind: "ready",
        missingItems: [],
        ...base,
      }
    : {
        kind: "not_ready",
        missingItems,
        ...base,
      };
};

export const isStructuredLogEventSafeToEmit = (event: StructuredLogEvent): true =>
  event.safeToEmit;
