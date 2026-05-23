import type {
  MediaRenderRef,
  SceneRenderRef,
  TimelineRenderSnapshot,
} from "../contracts/renderInputSnapshot";

const uniqueBy = <T, TKey>(
  values: T[],
  getKey: (value: T) => TKey,
): T[] => {
  const seen = new Set<TKey>();
  const unique: T[] = [];

  for (const value of values) {
    const key = getKey(value);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(value);
  }

  return unique;
};

export interface NormalizedRenderSnapshotSource {
  timelineSnapshot: TimelineRenderSnapshot;
  sceneRefs: SceneRenderRef[];
  mediaRefs: MediaRenderRef[];
}

export const normalizeRenderSnapshotSource = (
  source: NormalizedRenderSnapshotSource,
): NormalizedRenderSnapshotSource => ({
  timelineSnapshot: {
    timelineId: source.timelineSnapshot.timelineId,
    clips: [...source.timelineSnapshot.clips].sort(
      (left, right) => left.order - right.order,
    ),
  },
  sceneRefs: uniqueBy(source.sceneRefs, (sceneRef) => sceneRef.sceneId).map(
    (sceneRef) => ({ ...sceneRef }),
  ),
  mediaRefs: uniqueBy(source.mediaRefs, (mediaRef) => mediaRef.mediaId).map(
    (mediaRef) => ({ ...mediaRef }),
  ),
});
