export type SafeStructuredLogSeverity = "info" | "warn" | "error";

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

const sensitiveKeyParts = [
  "authorization",
  "cookie",
  "token",
  "secret",
  "service_role",
  "serviceRole",
  "apikey",
  "api_key",
  "privatekey",
  "private_key",
  "webhook",
  "prompt",
  "usertext",
  "rawtext",
  "rawprompt",
  "path",
] as const;

const signedUrlTokens = [
  "x-amz-algorithm",
  "x-amz-credential",
  "x-amz-signature",
  "token=",
  "signature=",
] as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSensitiveKey = (key: string): boolean => {
  const normalized = key.toLowerCase();
  return sensitiveKeyParts.some((token) => normalized.includes(token.toLowerCase()));
};

const isLikelyLocalPath = (value: string): boolean =>
  /^[a-zA-Z]:\\/.test(value) ||
  value.startsWith("\\\\") ||
  value.startsWith("/Users/") ||
  value.startsWith("/home/") ||
  value.startsWith("/var/") ||
  value.startsWith("file:/");

const isLikelySignedUrl = (value: string): boolean => {
  const normalized = value.toLowerCase();
  return (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://")
  ) && signedUrlTokens.some((token) => normalized.includes(token));
};

const isLikelySecretValue = (value: string): boolean => {
  const normalized = value.toLowerCase();
  return (
    normalized.startsWith("sk-") ||
    normalized.includes("service_role") ||
    normalized.includes("bearer ") ||
    normalized.includes("supabase_service_role")
  );
};

const sanitizeValue = (
  value: unknown,
  redactedFields: string[],
  fieldPath: string,
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      sanitizeValue(item, redactedFields, `${fieldPath}[${index}]`));
  }

  if (typeof value === "string") {
    if (
      isLikelyLocalPath(value) ||
      isLikelySignedUrl(value) ||
      isLikelySecretValue(value)
    ) {
      redactedFields.push(fieldPath);
      return "[redacted]";
    }

    return value;
  }

  if (!isObject(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = fieldPath ? `${fieldPath}.${key}` : key;

    if (isSensitiveKey(key)) {
      redactedFields.push(nestedPath);
      sanitized[key] = "[redacted]";
      continue;
    }

    sanitized[key] = sanitizeValue(nestedValue, redactedFields, nestedPath);
  }

  return sanitized;
};

export const createSafeStructuredLogEvent = ({
  event,
  severity,
  correlationId,
  jobId,
  reasonCode,
  metadata = {},
}: SafeStructuredLogEventInput): SafeStructuredLogEvent => {
  const redactedFields: string[] = [];
  const sanitizedMetadata = sanitizeValue(metadata, redactedFields, "");

  return {
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...(correlationId ? { correlationId } : {}),
    ...(jobId ? { jobId } : {}),
    ...(reasonCode ? { reasonCode } : {}),
    metadata: isObject(sanitizedMetadata) ? sanitizedMetadata : {},
    redactedFields,
  };
};
