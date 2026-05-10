import path from "node:path";

export type RenderOutputRootKey = "temp" | "output";

export interface RenderOutputPathPolicy {
  roots: Record<RenderOutputRootKey, string>;
  maxSegmentLength?: number;
}

export interface RenderOutputTargetDescriptor {
  rootKey: RenderOutputRootKey;
  jobId: string;
  baseName: string;
  extension: "mp4" | "webm";
}

export interface ResolvedRenderOutputPath {
  rootKey: RenderOutputRootKey;
  rootPath: string;
  jobSegment: string;
  fileName: string;
  directoryPath: string;
  filePath: string;
}

export class RenderOutputPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderOutputPathError";
  }
}

const DEFAULT_MAX_SEGMENT_LENGTH = 64;
const SAFE_SEGMENT_REGEX = /^[A-Za-z0-9_-]+$/;
const WINDOWS_RESERVED_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

export const sanitizePathSegment = (
  input: string,
  maxLength = DEFAULT_MAX_SEGMENT_LENGTH,
): string => {
  if (typeof input !== "string") {
    throw new RenderOutputPathError("Path segment must be a string.");
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new RenderOutputPathError("Path segment must not be empty.");
  }

  const stripped = trimmed.replace(/[^A-Za-z0-9_-]/g, "_");
  const collapsed = stripped.replace(/_+/g, "_");
  const normalized = collapsed.slice(0, maxLength);
  if (!normalized || !SAFE_SEGMENT_REGEX.test(normalized)) {
    throw new RenderOutputPathError("Path segment cannot be sanitized safely.");
  }

  validateSafePathSegment(normalized, maxLength);
  return normalized;
};

export const validateSafePathSegment = (
  segment: string,
  maxLength = DEFAULT_MAX_SEGMENT_LENGTH,
): string => {
  if (typeof segment !== "string") {
    throw new RenderOutputPathError("Path segment must be a string.");
  }

  if (!segment) {
    throw new RenderOutputPathError("Path segment must not be empty.");
  }

  if (segment.length > maxLength) {
    throw new RenderOutputPathError("Path segment exceeds max allowed length.");
  }

  if (segment.endsWith(" ") || segment.endsWith(".")) {
    throw new RenderOutputPathError("Path segment cannot end with a space or dot.");
  }

  if (!SAFE_SEGMENT_REGEX.test(segment)) {
    throw new RenderOutputPathError(
      "Path segment contains unsafe characters; use letters, numbers, '-' or '_'.",
    );
  }

  const upper = segment.toUpperCase();
  if (WINDOWS_RESERVED_NAMES.has(upper)) {
    throw new RenderOutputPathError("Path segment cannot use reserved Windows names.");
  }

  if (
    segment.includes("..") ||
    segment.includes("/") ||
    segment.includes("\\") ||
    /^[A-Za-z]:/.test(segment) ||
    segment.startsWith("\\\\") ||
    isUrlLike(segment)
  ) {
    throw new RenderOutputPathError("Path segment contains forbidden path syntax.");
  }

  return segment;
};

export const resolveRenderOutputPath = (
  policy: RenderOutputPathPolicy,
  descriptor: RenderOutputTargetDescriptor,
): ResolvedRenderOutputPath => {
  const rootPathRaw = policy.roots[descriptor.rootKey];
  if (!rootPathRaw || typeof rootPathRaw !== "string") {
    throw new RenderOutputPathError(
      `Missing root path configuration for '${descriptor.rootKey}'.`,
    );
  }

  const rootPath = path.resolve(rootPathRaw);
  const maxLength = policy.maxSegmentLength ?? DEFAULT_MAX_SEGMENT_LENGTH;

  const jobSegment = validateSafePathSegment(descriptor.jobId, maxLength);
  const baseName = validateSafePathSegment(descriptor.baseName, maxLength);
  const extension = descriptor.extension;
  if (extension !== "mp4" && extension !== "webm") {
    throw new RenderOutputPathError("Output extension must be 'mp4' or 'webm'.");
  }

  const fileName = `${baseName}.${extension}`;
  const directoryPath = path.resolve(rootPath, jobSegment);
  const filePath = path.resolve(directoryPath, fileName);

  ensureUnderRoot(rootPath, directoryPath);
  ensureUnderRoot(rootPath, filePath);

  return {
    rootKey: descriptor.rootKey,
    rootPath,
    jobSegment,
    fileName,
    directoryPath,
    filePath,
  };
};

export const createRenderOutputTarget = (
  rootKey: RenderOutputRootKey,
  jobId: string,
  baseName: string,
  extension: "mp4" | "webm",
): RenderOutputTargetDescriptor => ({
  rootKey,
  jobId: validateSafePathSegment(jobId),
  baseName: validateSafePathSegment(baseName),
  extension,
});

const ensureUnderRoot = (rootPath: string, resolvedPath: string): void => {
  const relative = path.relative(rootPath, resolvedPath);
  if (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  ) {
    return;
  }

  throw new RenderOutputPathError("Resolved path escaped configured root.");
};

const isUrlLike = (value: string): boolean => /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value);
