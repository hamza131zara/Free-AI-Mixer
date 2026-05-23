import type { SceneRecord } from "../types/scene";
import type { Timeline } from "../types/timeline";
import {
  exportSnapshotVersion,
  type TimelineExportSnapshot,
} from "../types/exportSnapshot";

export class ExportSnapshotBuilderError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "ExportSnapshotBuilderError";
    this.code = code;
  }
}

const resolveSceneMediaSelector = (scene: SceneRecord): string | undefined => {
  if (!scene.result) {
    return undefined;
  }

  if (
    typeof scene.selectedVariation === "string" &&
    scene.result.variations.includes(scene.selectedVariation)
  ) {
    return scene.selectedVariation;
  }

  return typeof scene.result.image === "string" ? scene.result.image : undefined;
};

const createMediaRefId = (sceneId: string): string => `scene-media:${sceneId}:selected`;

export const buildTimelineExportSnapshot = (
  timeline: Timeline,
  scenes: SceneRecord[],
): TimelineExportSnapshot => {
  if (!timeline.clips.length) {
    throw new ExportSnapshotBuilderError(
      "Export timeline has no clips.",
      "export_timeline_empty",
    );
  }

  const sceneById = new Map(scenes.map((scene) => [scene.id, scene] as const));
  const orderedClips = [...timeline.clips].sort((left, right) => left.order - right.order);
  const sceneRefs: TimelineExportSnapshot["sceneRefs"] = [];
  const mediaRefs: TimelineExportSnapshot["mediaRefs"] = [];
  const seenSceneIds = new Set<string>();

  for (const clip of orderedClips) {
    const scene = sceneById.get(clip.sceneId);
    if (!scene) {
      throw new ExportSnapshotBuilderError(
        `Scene '${clip.sceneId}' was not found for clip '${clip.id}'.`,
        "export_snapshot_scene_not_found",
      );
    }

    if (scene.lifecycle !== "success" || !scene.result) {
      throw new ExportSnapshotBuilderError(
        `Scene '${clip.sceneId}' is not ready for export snapshot construction.`,
        "export_snapshot_scene_not_ready",
      );
    }

    const selectedMedia = resolveSceneMediaSelector(scene);
    if (!selectedMedia || selectedMedia.trim().length === 0) {
      throw new ExportSnapshotBuilderError(
        `Scene '${clip.sceneId}' is missing a generated media reference.`,
        "export_snapshot_media_missing",
      );
    }

    if (!seenSceneIds.has(scene.id)) {
      seenSceneIds.add(scene.id);
      sceneRefs.push({
        sceneId: scene.id,
        role: "primary",
        contentType: "image",
      });
      mediaRefs.push({
        mediaId: createMediaRefId(scene.id),
        role: "selected",
        contentType: "image",
      });
    }
  }

  return {
    snapshotVersion: exportSnapshotVersion,
    timelineSnapshot: {
      timelineId: timeline.id,
      clips: orderedClips.map((clip) => ({
        clipId: clip.id,
        sceneRefId: clip.sceneId,
        startMs: clip.startMs,
        durationMs: clip.durationMs,
        order: clip.order,
      })),
    },
    sceneRefs,
    mediaRefs,
  };
};
