import type {
  MediaRenderRef,
  SceneRenderRef,
  TimelineRenderSnapshot,
} from "../../backend/contracts/renderInputSnapshot";

export const exportSnapshotVersion = 1 as const;

export interface TimelineExportSnapshot {
  snapshotVersion: typeof exportSnapshotVersion;
  timelineSnapshot: TimelineRenderSnapshot;
  sceneRefs: SceneRenderRef[];
  mediaRefs: MediaRenderRef[];
}
