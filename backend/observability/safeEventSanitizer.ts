export type SafeEventMetadataPrimitive = string | number | boolean | null;
export type SafeEventMetadataValue =
  | SafeEventMetadataPrimitive
  | SafeEventMetadata
  | SafeEventMetadataValue[];

export interface SafeEventMetadata {
  [key: string]: SafeEventMetadataValue;
}

export interface SafeEventSanitizationResult {
  sanitizedMetadata: SafeEventMetadata;
  redactedFields: string[];
  unsafeFieldPaths: string[];
  rejected: boolean;
}

const sensitiveKeyParts = [
  "authorization",
  "cookie",
  "session",
  "token",
  "secret",
  "service_role",
  "serviceRole",
  "apikey",
  "api_key",
  "encryptedpayload",
  "encrypted_payload",
  "privatekey",
  "private_key",
  "paymentsecret",
  "payment_secret",
  "cardnumber",
  "card_number",
  "cvv",
  "cvc",
  "webhook",
  "prompt",
  "usertext",
  "rawtext",
  "rawprompt",
  "path",
  "x-user-id",
  "x-workspace-id",
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
    normalized.includes("supabase_service_role") ||
    /^[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+$/i.test(value)
  );
};

const sanitizeValue = (
  value: unknown,
  redactedFields: string[],
  unsafeFieldPaths: string[],
  fieldPath: string,
): SafeEventMetadataValue => {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      sanitizeValue(item, redactedFields, unsafeFieldPaths, `${fieldPath}[${index}]`));
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  if (typeof value === "string") {
    if (
      isLikelyLocalPath(value) ||
      isLikelySignedUrl(value) ||
      isLikelySecretValue(value)
    ) {
      redactedFields.push(fieldPath);
      unsafeFieldPaths.push(fieldPath);
      return "[redacted]";
    }

    return value;
  }

  if (!isObject(value)) {
    redactedFields.push(fieldPath || "metadata");
    unsafeFieldPaths.push(fieldPath || "metadata");
    return "[redacted]";
  }

  const sanitized: SafeEventMetadata = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = fieldPath ? `${fieldPath}.${key}` : key;

    if (isSensitiveKey(key)) {
      redactedFields.push(nestedPath);
      unsafeFieldPaths.push(nestedPath);
      sanitized[key] = "[redacted]";
      continue;
    }

    sanitized[key] = sanitizeValue(
      nestedValue,
      redactedFields,
      unsafeFieldPaths,
      nestedPath,
    );
  }

  return sanitized;
};

export const sanitizeSafeEventMetadata = (
  metadata: Record<string, unknown> = {},
): SafeEventSanitizationResult => {
  const redactedFields: string[] = [];
  const unsafeFieldPaths: string[] = [];
  const sanitized = sanitizeValue(metadata, redactedFields, unsafeFieldPaths, "");

  return {
    sanitizedMetadata: isObject(sanitized) ? sanitized : {},
    redactedFields,
    unsafeFieldPaths,
    rejected: unsafeFieldPaths.length > 0,
  };
};
