export type RendererFailureCode =
  | "input_snapshot_invalid"
  | "output_path_invalid"
  | "renderer_execution_failed"
  | "renderer_timed_out"
  | "renderer_cancelled_or_aborted"
  | "output_write_failed"
  | "artifact_verification_failed"
  | "artifact_file_missing"
  | "artifact_file_empty"
  | "artifact_format_mismatch";

export type RendererFailureStage =
  | "snapshot"
  | "path"
  | "render"
  | "verify"
  | "finalize";

export type RendererFailureCauseCategory =
  | "validation"
  | "runtime"
  | "timeout"
  | "abort"
  | "io"
  | "verification";

export type RendererMappedFailure = {
  code: RendererFailureCode;
  message: string;
  stage: RendererFailureStage;
  retryable: boolean;
  causeCategory: RendererFailureCauseCategory;
  details?: Record<string, unknown>;
};

export type RendererFailureInput = {
  error: unknown;
  stage?: RendererFailureStage;
  codeHint?: RendererFailureCode;
  transient?: boolean;
  details?: Record<string, unknown>;
};

const ARTIFACT_CODES: RendererFailureCode[] = [
  "artifact_verification_failed",
  "artifact_file_missing",
  "artifact_file_empty",
  "artifact_format_mismatch",
];

const safeMessage = (value: unknown): string =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "Renderer failure occurred.";

const lower = (value: unknown): string =>
  typeof value === "string" ? value.toLowerCase() : "";

const extractErrorShape = (
  error: unknown
): { name?: string; message?: string; code?: string } => {
  if (!error || typeof error !== "object") {
    return {};
  }
  const typed = error as Record<string, unknown>;
  return {
    name: typeof typed.name === "string" ? typed.name : undefined,
    message: typeof typed.message === "string" ? typed.message : undefined,
    code: typeof typed.code === "string" ? typed.code : undefined,
  };
};

export const isTimeoutError = (error: unknown): boolean => {
  const shape = extractErrorShape(error);
  const text = `${lower(shape.name)} ${lower(shape.message)} ${lower(shape.code)}`;
  return (
    text.includes("timeout") ||
    text.includes("timed out") ||
    text.includes("etimedout")
  );
};

export const isAbortError = (error: unknown): boolean => {
  const shape = extractErrorShape(error);
  const text = `${lower(shape.name)} ${lower(shape.message)} ${lower(shape.code)}`;
  return (
    text.includes("aborterror") ||
    text.includes("aborted") ||
    text.includes("cancelled") ||
    text.includes("canceled") ||
    text.includes("abort_err")
  );
};

const looksLikeOutputPathError = (error: unknown, stage?: RendererFailureStage): boolean => {
  if (stage === "path") {
    return true;
  }
  const shape = extractErrorShape(error);
  const text = `${lower(shape.name)} ${lower(shape.message)} ${lower(shape.code)}`;
  return (
    text.includes("path") ||
    text.includes("traversal") ||
    text.includes("unc") ||
    text.includes("drive-letter")
  );
};

const looksLikeSnapshotError = (error: unknown, stage?: RendererFailureStage): boolean => {
  if (stage === "snapshot") {
    return true;
  }
  const shape = extractErrorShape(error);
  const text = `${lower(shape.name)} ${lower(shape.message)} ${lower(shape.code)}`;
  return text.includes("snapshot") || text.includes("renderinputsnapshot");
};

const mapCauseCategory = (code: RendererFailureCode): RendererFailureCauseCategory => {
  switch (code) {
    case "input_snapshot_invalid":
      return "validation";
    case "output_path_invalid":
      return "validation";
    case "renderer_timed_out":
      return "timeout";
    case "renderer_cancelled_or_aborted":
      return "abort";
    case "output_write_failed":
      return "io";
    case "artifact_verification_failed":
    case "artifact_file_missing":
    case "artifact_file_empty":
    case "artifact_format_mismatch":
      return "verification";
    case "renderer_execution_failed":
    default:
      return "runtime";
  }
};

const isRetryable = (code: RendererFailureCode, transient?: boolean): boolean => {
  switch (code) {
    case "renderer_timed_out":
      return true;
    case "renderer_execution_failed":
      return transient === true;
    case "output_write_failed":
      return transient === true;
    case "renderer_cancelled_or_aborted":
    case "input_snapshot_invalid":
    case "output_path_invalid":
    case "artifact_verification_failed":
    case "artifact_file_missing":
    case "artifact_file_empty":
    case "artifact_format_mismatch":
    default:
      return false;
  }
};

const pickCode = (input: RendererFailureInput): RendererFailureCode => {
  if (input.codeHint) {
    return input.codeHint;
  }

  const shape = extractErrorShape(input.error);
  if (shape.code && ARTIFACT_CODES.includes(shape.code as RendererFailureCode)) {
    return shape.code as RendererFailureCode;
  }

  if (isTimeoutError(input.error)) {
    return "renderer_timed_out";
  }
  if (isAbortError(input.error)) {
    return "renderer_cancelled_or_aborted";
  }
  if (looksLikeSnapshotError(input.error, input.stage)) {
    return "input_snapshot_invalid";
  }
  if (looksLikeOutputPathError(input.error, input.stage)) {
    return "output_path_invalid";
  }

  const text = `${lower(shape.name)} ${lower(shape.message)} ${lower(shape.code)}`;
  if (text.includes("write") || text.includes("eacces") || text.includes("enospc")) {
    return "output_write_failed";
  }

  return "renderer_execution_failed";
};

const looksSensitive = (value: string): boolean => {
  const v = value.toLowerCase();
  return (
    v.includes("token") ||
    v.includes("secret") ||
    v.includes("apikey") ||
    v.includes("api_key") ||
    v.includes("password") ||
    v.includes("bearer ") ||
    v.includes("authorization") ||
    v.includes("http://") ||
    v.includes("https://") ||
    v.includes("downloadurl") ||
    v.includes("signedurl") ||
    v.includes("publicurl") ||
    v.includes("file://") ||
    v.includes(":\\") ||
    v.includes("../") ||
    v.includes("..\\")
  );
};

export const sanitizeRendererFailureDetails = (
  details?: Record<string, unknown>
): Record<string, unknown> | undefined => {
  if (!details) {
    return undefined;
  }

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    const loweredKey = key.toLowerCase();
    if (
      loweredKey.includes("stack") ||
      loweredKey.includes("path") ||
      loweredKey.includes("url") ||
      loweredKey.includes("download") ||
      loweredKey.includes("publicurl") ||
      loweredKey.includes("signedurl") ||
      loweredKey.includes("token") ||
      loweredKey.includes("secret") ||
      loweredKey.includes("password") ||
      loweredKey.includes("env") ||
      loweredKey.includes("argv") ||
      loweredKey.includes("command")
    ) {
      continue;
    }

    if (
      typeof value === "string" &&
      (looksSensitive(value) || value.length > 300)
    ) {
      continue;
    }

    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      safe[key] = value;
    }
  }

  return Object.keys(safe).length > 0 ? safe : undefined;
};

export const mapRendererFailure = (input: RendererFailureInput): RendererMappedFailure => {
  const code = pickCode(input);
  const shape = extractErrorShape(input.error);
  const message = safeMessage(shape.message);
  const stage = input.stage ?? "render";

  return {
    code,
    message,
    stage,
    retryable: isRetryable(code, input.transient),
    causeCategory: mapCauseCategory(code),
    details: sanitizeRendererFailureDetails(input.details),
  };
};

export const toPublicSafeRendererFailure = (
  failure: RendererMappedFailure
): RendererMappedFailure => ({
  code: failure.code,
  message: failure.message,
  stage: failure.stage,
  retryable: failure.retryable,
  causeCategory: failure.causeCategory,
  details: sanitizeRendererFailureDetails(failure.details),
});
