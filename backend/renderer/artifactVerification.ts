import path from "node:path";
import { promises as fs } from "node:fs";
import type { BackendArtifactMetadata } from "../contracts/exportHttpTypes";
import type { ResolvedRenderOutputPath } from "./outputPathPolicy";

export type ArtifactVerificationFailureCode =
  | "artifact_verification_failed"
  | "artifact_file_missing"
  | "artifact_file_empty"
  | "artifact_format_mismatch";

export type ArtifactVerificationError = {
  code: ArtifactVerificationFailureCode;
  message: string;
};

export type VerifiedArtifactInput = {
  artifactId: string;
  jobId: string;
  kind: string;
  expectedFormat: string;
  resolvedOutputPath: ResolvedRenderOutputPath;
  createdAt?: string;
};

export type VerifiedArtifactResult =
  | { ok: true; artifact: BackendArtifactMetadata }
  | { ok: false; error: ArtifactVerificationError };

const ensureNonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
};

const isWithinRoot = (filePath: string, rootPath: string): boolean => {
  const normalizedFile = path.resolve(filePath);
  const normalizedRoot = path.resolve(rootPath);

  if (normalizedFile === normalizedRoot) {
    return false;
  }

  const rootWithSep = normalizedRoot.endsWith(path.sep)
    ? normalizedRoot
    : `${normalizedRoot}${path.sep}`;
  return normalizedFile.startsWith(rootWithSep);
};

const normalizeExpectedExtension = (format: string): string => {
  const cleaned = format.trim().toLowerCase();
  return cleaned.startsWith(".") ? cleaned : `.${cleaned}`;
};

export const verifyFileExistsAndIsFile = async (
  filePath: string
): Promise<{ ok: true; sizeBytes: number } | { ok: false; error: ArtifactVerificationError }> => {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return {
        ok: false,
        error: {
          code: "artifact_verification_failed",
          message: "Verified output target is not a regular file.",
        },
      };
    }

    return { ok: true, sizeBytes: stats.size };
  } catch {
    return {
      ok: false,
      error: {
        code: "artifact_file_missing",
        message: "Rendered artifact file was not found.",
      },
    };
  }
};

export const verifyFileSizePositive = (
  sizeBytes: number
): { ok: true } | { ok: false; error: ArtifactVerificationError } => {
  if (sizeBytes <= 0) {
    return {
      ok: false,
      error: {
        code: "artifact_file_empty",
        message: "Rendered artifact file is empty.",
      },
    };
  }
  return { ok: true };
};

export const verifyFileFormatMatchesExpected = (
  filePath: string,
  expectedFormat: string
): { ok: true } | { ok: false; error: ArtifactVerificationError } => {
  const expectedExt = normalizeExpectedExtension(expectedFormat);
  const actualExt = path.extname(filePath).toLowerCase();

  if (actualExt !== expectedExt) {
    return {
      ok: false,
      error: {
        code: "artifact_format_mismatch",
        message: "Rendered artifact file format does not match expected output format.",
      },
    };
  }

  return { ok: true };
};

export const buildVerifiedArtifactMetadata = (
  input: Pick<VerifiedArtifactInput, "artifactId" | "jobId" | "kind" | "expectedFormat" | "createdAt"> & {
    sizeBytes: number;
  }
): BackendArtifactMetadata => ({
  artifactId: input.artifactId,
  jobId: input.jobId,
  kind: input.kind,
  format: input.expectedFormat,
  status: "available",
  createdAt: input.createdAt ?? new Date().toISOString(),
  sizeBytes: input.sizeBytes,
});

export const verifyRenderedArtifact = async (
  input: VerifiedArtifactInput
): Promise<VerifiedArtifactResult> => {
  try {
    const artifactId = ensureNonEmptyString(input.artifactId, "artifactId");
    const jobId = ensureNonEmptyString(input.jobId, "jobId");
    const kind = ensureNonEmptyString(input.kind, "kind");
    const expectedFormat = ensureNonEmptyString(input.expectedFormat, "expectedFormat");
    const filePath = ensureNonEmptyString(input.resolvedOutputPath.filePath, "resolvedOutputPath.filePath");
    const rootPath = ensureNonEmptyString(input.resolvedOutputPath.rootPath, "resolvedOutputPath.rootPath");

    if (!isWithinRoot(filePath, rootPath)) {
      return {
        ok: false,
        error: {
          code: "artifact_verification_failed",
          message: "Resolved output file path must remain within the configured output root.",
        },
      };
    }

    const formatCheck = verifyFileFormatMatchesExpected(filePath, expectedFormat);
    if (!formatCheck.ok) {
      return { ok: false, error: formatCheck.error };
    }

    const existsCheck = await verifyFileExistsAndIsFile(filePath);
    if (!existsCheck.ok) {
      return { ok: false, error: existsCheck.error };
    }

    const sizeCheck = verifyFileSizePositive(existsCheck.sizeBytes);
    if (!sizeCheck.ok) {
      return { ok: false, error: sizeCheck.error };
    }

    return {
      ok: true,
      artifact: buildVerifiedArtifactMetadata({
        artifactId,
        jobId,
        kind,
        expectedFormat,
        createdAt: input.createdAt,
        sizeBytes: existsCheck.sizeBytes,
      }),
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "artifact_verification_failed",
        message: "Artifact verification failed due to invalid verification input.",
      },
    };
  }
};
