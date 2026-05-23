import type { ExportRenderSettings } from "../../src/types/exportJob";

export type RendererOutputFormat = "mp4" | "webm";

export interface RenderClipSnapshot {
  clipId: string;
  sceneRefId: string;
  startMs: number;
  durationMs: number;
  order: number;
}

export interface TimelineRenderSnapshot {
  timelineId: string;
  clips: RenderClipSnapshot[];
}

export interface SceneRenderRef {
  sceneId: string;
  role?: string;
  contentType?: string;
}

export interface MediaRenderRef {
  mediaId: string;
  role?: string;
  contentType?: string;
}

export interface RenderOutputTarget {
  jobFolderKey: string;
  artifactBaseName: string;
  format: RendererOutputFormat;
}

export interface RenderInputSnapshot {
  snapshotVersion?: typeof renderInputSnapshotVersion;
  jobId: string;
  timelineId: string;
  renderSettings: ExportRenderSettings;
  timelineSnapshot: TimelineRenderSnapshot;
  sceneRefs: SceneRenderRef[];
  mediaRefs: MediaRenderRef[];
  outputTarget: RenderOutputTarget;
}

export const renderInputSnapshotVersion = 1 as const;

export class RenderInputSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderInputSnapshotError";
  }
}

export const validateRenderInputSnapshot = (
  input: unknown,
): RenderInputSnapshot => {
  if (typeof input !== "object" || input === null) {
    throw new RenderInputSnapshotError("Render input snapshot must be an object.");
  }

  const candidate = input as Record<string, unknown>;
  const snapshotVersion = readSnapshotVersion(candidate.snapshotVersion);

  const jobId = readNonEmptyString(candidate.jobId, "jobId");
  const timelineId = readNonEmptyString(candidate.timelineId, "timelineId");
  const renderSettings = validateRenderSettings(candidate.renderSettings);
  const timelineSnapshot = validateTimelineSnapshot(candidate.timelineSnapshot);
  if (timelineSnapshot.timelineId !== timelineId) {
    throw new RenderInputSnapshotError(
      "timelineSnapshot.timelineId must match timelineId.",
    );
  }

  const sceneRefs = validateSceneRefs(candidate.sceneRefs);
  const mediaRefs = validateMediaRefs(candidate.mediaRefs);
  if (sceneRefs.length === 0 && mediaRefs.length === 0) {
    throw new RenderInputSnapshotError(
      "At least one sceneRefs or mediaRefs entry is required.",
    );
  }

  const outputTarget = validateOutputTarget(candidate.outputTarget);

  rejectUnsafeTopLevelFields(candidate);

  return {
    snapshotVersion,
    jobId,
    timelineId,
    renderSettings,
    timelineSnapshot,
    sceneRefs,
    mediaRefs,
    outputTarget,
  };
};

const readSnapshotVersion = (
  value: unknown,
): typeof renderInputSnapshotVersion => {
  if (value === undefined) {
    return renderInputSnapshotVersion;
  }

  if (value !== renderInputSnapshotVersion) {
    throw new RenderInputSnapshotError(
      `snapshotVersion must be ${renderInputSnapshotVersion}.`,
    );
  }

  return renderInputSnapshotVersion;
};

export const createRenderInputSnapshot = (
  input: unknown,
): RenderInputSnapshot => {
  const validated = validateRenderInputSnapshot(input);
  const cloned = deepClone(validated);
  return deepFreeze(cloned);
};

const validateRenderSettings = (value: unknown): ExportRenderSettings => {
  if (typeof value !== "object" || value === null) {
    throw new RenderInputSnapshotError("renderSettings is required.");
  }

  const candidate = value as Partial<ExportRenderSettings>;
  const allowedFormats = new Set(["mp4", "webm"]);
  const allowedResolutions = new Set(["720p", "1080p", "1440p", "2160p"]);
  const allowedFps = new Set([24, 30, 60]);
  const allowedQuality = new Set(["draft", "standard", "high"]);

  if (!allowedFormats.has(candidate.format as string)) {
    throw new RenderInputSnapshotError("renderSettings.format is invalid.");
  }
  if (!allowedResolutions.has(candidate.resolution as string)) {
    throw new RenderInputSnapshotError("renderSettings.resolution is invalid.");
  }
  if (!allowedFps.has(candidate.fps as number)) {
    throw new RenderInputSnapshotError("renderSettings.fps is invalid.");
  }
  if (!allowedQuality.has(candidate.quality as string)) {
    throw new RenderInputSnapshotError("renderSettings.quality is invalid.");
  }

  return candidate as ExportRenderSettings;
};

const validateTimelineSnapshot = (value: unknown): TimelineRenderSnapshot => {
  if (typeof value !== "object" || value === null) {
    throw new RenderInputSnapshotError("timelineSnapshot is required.");
  }

  const candidate = value as Record<string, unknown>;
  const timelineId = readNonEmptyString(candidate.timelineId, "timelineSnapshot.timelineId");
  const clipsValue = candidate.clips;
  if (!Array.isArray(clipsValue) || clipsValue.length === 0) {
    throw new RenderInputSnapshotError(
      "timelineSnapshot.clips must be a non-empty array.",
    );
  }

  const clips = clipsValue.map((clip, index) => validateClip(clip, index));
  return { timelineId, clips };
};

const validateClip = (value: unknown, index: number): RenderClipSnapshot => {
  if (typeof value !== "object" || value === null) {
    throw new RenderInputSnapshotError(`timelineSnapshot.clips[${index}] is invalid.`);
  }

  const candidate = value as Record<string, unknown>;
  const clipId = readNonEmptyString(candidate.clipId, `clips[${index}].clipId`);
  const sceneRefId = readNonEmptyString(
    candidate.sceneRefId,
    `clips[${index}].sceneRefId`,
  );
  const startMs = readNonNegativeNumber(candidate.startMs, `clips[${index}].startMs`);
  const durationMs = readPositiveNumber(
    candidate.durationMs,
    `clips[${index}].durationMs`,
  );
  const order = readNonNegativeInteger(candidate.order, `clips[${index}].order`);

  rejectBlobLikeFields(candidate, `clips[${index}]`);

  return { clipId, sceneRefId, startMs, durationMs, order };
};

const validateSceneRefs = (value: unknown): SceneRenderRef[] => {
  if (value === undefined) {
    throw new RenderInputSnapshotError("sceneRefs is required.");
  }
  if (!Array.isArray(value)) {
    throw new RenderInputSnapshotError("sceneRefs must be an array.");
  }

  return value.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new RenderInputSnapshotError(`sceneRefs[${index}] is invalid.`);
    }
    const candidate = entry as Record<string, unknown>;
    const sceneId = readNonEmptyString(candidate.sceneId, `sceneRefs[${index}].sceneId`);
    rejectBlobLikeFields(candidate, `sceneRefs[${index}]`);
    rejectUrlFields(candidate, `sceneRefs[${index}]`);
    return {
      sceneId,
      ...(typeof candidate.role === "string" ? { role: candidate.role } : {}),
      ...(typeof candidate.contentType === "string"
        ? { contentType: candidate.contentType }
        : {}),
    };
  });
};

const validateMediaRefs = (value: unknown): MediaRenderRef[] => {
  if (value === undefined) {
    throw new RenderInputSnapshotError("mediaRefs is required.");
  }
  if (!Array.isArray(value)) {
    throw new RenderInputSnapshotError("mediaRefs must be an array.");
  }

  return value.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new RenderInputSnapshotError(`mediaRefs[${index}] is invalid.`);
    }
    const candidate = entry as Record<string, unknown>;
    const mediaId = readNonEmptyString(candidate.mediaId, `mediaRefs[${index}].mediaId`);
    rejectBlobLikeFields(candidate, `mediaRefs[${index}]`);
    rejectUrlFields(candidate, `mediaRefs[${index}]`);
    return {
      mediaId,
      ...(typeof candidate.role === "string" ? { role: candidate.role } : {}),
      ...(typeof candidate.contentType === "string"
        ? { contentType: candidate.contentType }
        : {}),
    };
  });
};

const validateOutputTarget = (value: unknown): RenderOutputTarget => {
  if (typeof value !== "object" || value === null) {
    throw new RenderInputSnapshotError("outputTarget is required.");
  }

  const candidate = value as Record<string, unknown>;
  rejectUrlFields(candidate, "outputTarget");
  rejectPathFields(candidate, "outputTarget");

  const jobFolderKey = readSafeKey(candidate.jobFolderKey, "outputTarget.jobFolderKey");
  const artifactBaseName = readSafeKey(
    candidate.artifactBaseName,
    "outputTarget.artifactBaseName",
  );
  const format = readOutputFormat(candidate.format, "outputTarget.format");

  return { jobFolderKey, artifactBaseName, format };
};

const rejectUnsafeTopLevelFields = (candidate: Record<string, unknown>): void => {
  rejectBlobLikeFields(candidate, "snapshot");
  rejectUrlFields(candidate, "snapshot");
};

const rejectBlobLikeFields = (candidate: Record<string, unknown>, path: string): void => {
  const blocked = ["blob", "binary", "buffer", "arrayBuffer", "base64Data"];
  for (const key of blocked) {
    if (key in candidate) {
      throw new RenderInputSnapshotError(`${path}.${key} is not allowed.`);
    }
  }
};

const rejectUrlFields = (candidate: Record<string, unknown>, path: string): void => {
  const blocked = ["url", "downloadUrl", "publicUrl", "signedUrl"];
  for (const key of blocked) {
    if (key in candidate) {
      throw new RenderInputSnapshotError(`${path}.${key} is not allowed in this phase.`);
    }
  }
};

const rejectPathFields = (candidate: Record<string, unknown>, path: string): void => {
  const blocked = ["path", "filePath", "localPath", "absolutePath", "relativePath"];
  for (const key of blocked) {
    if (key in candidate) {
      throw new RenderInputSnapshotError(`${path}.${key} is not allowed.`);
    }
  }
};

const readNonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RenderInputSnapshotError(`${field} must be a non-empty string.`);
  }
  return value;
};

const readNonNegativeNumber = (value: unknown, field: string): number => {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new RenderInputSnapshotError(`${field} must be a non-negative number.`);
  }
  return value;
};

const readPositiveNumber = (value: unknown, field: string): number => {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    throw new RenderInputSnapshotError(`${field} must be a positive number.`);
  }
  return value;
};

const readNonNegativeInteger = (value: unknown, field: string): number => {
  if (
    typeof value !== "number" ||
    Number.isNaN(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new RenderInputSnapshotError(`${field} must be a non-negative integer.`);
  }
  return value;
};

const readOutputFormat = (value: unknown, field: string): RendererOutputFormat => {
  if (value !== "mp4" && value !== "webm") {
    throw new RenderInputSnapshotError(`${field} must be 'mp4' or 'webm'.`);
  }
  return value;
};

const readSafeKey = (value: unknown, field: string): string => {
  const key = readNonEmptyString(value, field);
  if (key.includes("..") || key.includes("/") || key.includes("\\") || key.includes(":")) {
    throw new RenderInputSnapshotError(
      `${field} contains unsafe path traversal characters.`,
    );
  }
  return key;
};

const deepClone = <T>(value: T): T => {
  return JSON.parse(JSON.stringify(value)) as T;
};

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return value;
};
