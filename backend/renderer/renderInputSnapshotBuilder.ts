import {
  createRenderInputSnapshot,
  RenderInputSnapshotError,
  renderInputSnapshotVersion,
  type MediaRenderRef,
  type RenderInputSnapshot,
  type SceneRenderRef,
  type TimelineRenderSnapshot,
} from "../contracts/renderInputSnapshot";
import type { ExportRenderSettings } from "../../src/types/exportJob";
import {
  normalizeRenderSnapshotSource,
  type NormalizedRenderSnapshotSource,
} from "./renderInputNormalization";

const mediaRefPrefix = "scene-media:";

export class RenderInputSnapshotBuilderError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "RenderInputSnapshotBuilderError";
    this.code = code;
  }
}

export interface TimelineExportSnapshotSource {
  snapshotVersion?: unknown;
  timelineSnapshot?: unknown;
  sceneRefs?: unknown;
  mediaRefs?: unknown;
}

export interface BuildRenderInputSnapshotInput {
  jobId: string;
  timelineId: string;
  renderSettings: ExportRenderSettings;
  snapshotSource: TimelineExportSnapshotSource;
}

const asRecord = (
  value: unknown,
  field: string,
): Record<string, unknown> => {
  if (typeof value !== "object" || value === null) {
    throw new RenderInputSnapshotBuilderError(
      `${field} must be an object.`,
      "render_snapshot_invalid",
    );
  }

  return value as Record<string, unknown>;
};

const rejectUnsafeReferenceFields = (
  value: Record<string, unknown>,
  field: string,
): void => {
  const blocked = [
    "url",
    "publicUrl",
    "signedUrl",
    "downloadUrl",
    "path",
    "filePath",
    "localPath",
    "absolutePath",
    "relativePath",
    "blob",
    "blobUrl",
  ];

  for (const key of blocked) {
    if (key in value) {
      throw new RenderInputSnapshotBuilderError(
        `${field}.${key} is not allowed in render snapshot input.`,
        "render_snapshot_unsafe_reference",
      );
    }
  }
};

const toTimelineSnapshot = (value: unknown): TimelineRenderSnapshot => {
  const candidate = asRecord(value, "timelineSnapshot");
  rejectUnsafeReferenceFields(candidate, "timelineSnapshot");

  if (
    typeof candidate.timelineId !== "string" ||
    !Array.isArray(candidate.clips) ||
    candidate.clips.length === 0
  ) {
    throw new RenderInputSnapshotBuilderError(
      "timelineSnapshot is invalid.",
      "render_snapshot_invalid",
    );
  }

  return {
    timelineId: candidate.timelineId,
    clips: candidate.clips.map((clip, index) => {
      const clipCandidate = asRecord(clip, `timelineSnapshot.clips[${index}]`);
      rejectUnsafeReferenceFields(clipCandidate, `timelineSnapshot.clips[${index}]`);

      if (
        typeof clipCandidate.clipId !== "string" ||
        typeof clipCandidate.sceneRefId !== "string" ||
        typeof clipCandidate.startMs !== "number" ||
        typeof clipCandidate.durationMs !== "number" ||
        typeof clipCandidate.order !== "number"
      ) {
        throw new RenderInputSnapshotBuilderError(
          `timelineSnapshot.clips[${index}] is invalid.`,
          "render_snapshot_invalid",
        );
      }

      return {
        clipId: clipCandidate.clipId,
        sceneRefId: clipCandidate.sceneRefId,
        startMs: clipCandidate.startMs,
        durationMs: clipCandidate.durationMs,
        order: clipCandidate.order,
      };
    }),
  };
};

const toSceneRefs = (value: unknown): SceneRenderRef[] => {
  if (!Array.isArray(value)) {
    throw new RenderInputSnapshotBuilderError(
      "sceneRefs must be an array.",
      "render_snapshot_invalid",
    );
  }

  return value.map((entry, index) => {
    const candidate = asRecord(entry, `sceneRefs[${index}]`);
    rejectUnsafeReferenceFields(candidate, `sceneRefs[${index}]`);

    if (typeof candidate.sceneId !== "string" || candidate.sceneId.trim().length === 0) {
      throw new RenderInputSnapshotBuilderError(
        `sceneRefs[${index}].sceneId must be a non-empty string.`,
        "render_snapshot_invalid",
      );
    }

    return {
      sceneId: candidate.sceneId,
      ...(typeof candidate.role === "string" ? { role: candidate.role } : {}),
      ...(typeof candidate.contentType === "string"
        ? { contentType: candidate.contentType }
        : {}),
    };
  });
};

const toMediaRefs = (value: unknown): MediaRenderRef[] => {
  if (!Array.isArray(value)) {
    throw new RenderInputSnapshotBuilderError(
      "mediaRefs must be an array.",
      "render_snapshot_invalid",
    );
  }

  return value.map((entry, index) => {
    const candidate = asRecord(entry, `mediaRefs[${index}]`);
    rejectUnsafeReferenceFields(candidate, `mediaRefs[${index}]`);

    if (typeof candidate.mediaId !== "string" || candidate.mediaId.trim().length === 0) {
      throw new RenderInputSnapshotBuilderError(
        `mediaRefs[${index}].mediaId must be a non-empty string.`,
        "render_snapshot_invalid",
      );
    }

    return {
      mediaId: candidate.mediaId,
      ...(typeof candidate.role === "string" ? { role: candidate.role } : {}),
      ...(typeof candidate.contentType === "string"
        ? { contentType: candidate.contentType }
        : {}),
    };
  });
};

const assertSnapshotVersion = (value: unknown): void => {
  if (value === undefined || value === renderInputSnapshotVersion) {
    return;
  }

  throw new RenderInputSnapshotBuilderError(
    `snapshotVersion must be ${renderInputSnapshotVersion}.`,
    "render_snapshot_invalid_version",
  );
};

const assertClipSceneRefsExist = (
  timelineSnapshot: TimelineRenderSnapshot,
  sceneRefs: SceneRenderRef[],
): void => {
  const sceneRefIds = new Set(sceneRefs.map((sceneRef) => sceneRef.sceneId));

  for (const clip of timelineSnapshot.clips) {
    if (!sceneRefIds.has(clip.sceneRefId)) {
      throw new RenderInputSnapshotBuilderError(
        `Clip '${clip.clipId}' references scene '${clip.sceneRefId}' without a matching sceneRef.`,
        "render_snapshot_scene_ref_missing",
      );
    }
  }
};

const assertSceneMediaRefsExist = (
  sceneRefs: SceneRenderRef[],
  mediaRefs: MediaRenderRef[],
): void => {
  const mediaIds = new Set(mediaRefs.map((mediaRef) => mediaRef.mediaId));

  for (const sceneRef of sceneRefs) {
    if (!mediaIds.has(`${mediaRefPrefix}${sceneRef.sceneId}:selected`)) {
      throw new RenderInputSnapshotBuilderError(
        `Scene '${sceneRef.sceneId}' is missing a matching mediaRef.`,
        "render_snapshot_media_ref_missing",
      );
    }
  }
};

const toNormalizedSnapshotSource = (
  snapshotSource: TimelineExportSnapshotSource,
): NormalizedRenderSnapshotSource => {
  assertSnapshotVersion(snapshotSource.snapshotVersion);

  return normalizeRenderSnapshotSource({
    timelineSnapshot: toTimelineSnapshot(snapshotSource.timelineSnapshot),
    sceneRefs: toSceneRefs(snapshotSource.sceneRefs),
    mediaRefs: toMediaRefs(snapshotSource.mediaRefs),
  });
};

export const buildRenderInputSnapshot = (
  input: BuildRenderInputSnapshotInput,
): RenderInputSnapshot => {
  const normalized = toNormalizedSnapshotSource(input.snapshotSource);

  assertClipSceneRefsExist(normalized.timelineSnapshot, normalized.sceneRefs);
  assertSceneMediaRefsExist(normalized.sceneRefs, normalized.mediaRefs);

  try {
    return createRenderInputSnapshot({
      snapshotVersion: renderInputSnapshotVersion,
      jobId: input.jobId,
      timelineId: input.timelineId,
      renderSettings: input.renderSettings,
      timelineSnapshot: normalized.timelineSnapshot,
      sceneRefs: normalized.sceneRefs,
      mediaRefs: normalized.mediaRefs,
      outputTarget: {
        jobFolderKey: input.jobId,
        artifactBaseName: "output",
        format: input.renderSettings.format,
      },
    });
  } catch (error) {
    if (error instanceof RenderInputSnapshotError) {
      throw new RenderInputSnapshotBuilderError(
        error.message,
        "render_snapshot_invalid",
      );
    }

    throw error;
  }
};
