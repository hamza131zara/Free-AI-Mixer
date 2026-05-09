import { TimelineClipItem } from "./TimelineClipItem";
import { useTimelineStore } from "../store/timelineStore";
import type { TimelineId } from "../types/timeline";

interface TimelineTrackProps {
  timelineId?: TimelineId;
  totalDurationMs: number;
  selectedClipId?: string;
  clips: Array<{
    id: string;
    order: number;
    sceneId: string;
    startMs: number;
    durationMs: number;
    label?: string;
    source: "scene";
  }>;
  onSelectClip: (timelineId: TimelineId, clipId?: string) => void;
  onRemoveClip: (timelineId: TimelineId, clipId: string) => void;
}

export function TimelineTrack({
  timelineId,
  totalDurationMs,
  selectedClipId,
  clips,
  onSelectClip,
  onRemoveClip,
}: TimelineTrackProps) {
  const moveClipUp = useTimelineStore((state) => state.moveClipUp);
  const moveClipDown = useTimelineStore((state) => state.moveClipDown);

  if (!timelineId) {
    return (
      <section className="scene-queue scene-queue-empty" data-testid="timeline-track">
        <p>Create a timeline to begin editing clips.</p>
      </section>
    );
  }

  if (clips.length === 0) {
    return (
      <section className="scene-queue scene-queue-empty" data-testid="timeline-track">
        <p>Timeline is empty. Scene source add-flow is coming in the next phase.</p>
        <p className="scene-stage-note">Total duration: {totalDurationMs}ms</p>
      </section>
    );
  }

  return (
    <section className="scene-queue" data-testid="timeline-track">
      <p className="scene-stage-note">Total duration: {totalDurationMs}ms</p>
      {clips.map((clip, index) => (
        <TimelineClipItem
          key={clip.id}
          timelineId={timelineId}
          clip={clip}
          isSelected={selectedClipId === clip.id}
          canMoveUp={index > 0}
          canMoveDown={index < clips.length - 1}
          onSelect={onSelectClip}
          onMoveUp={moveClipUp}
          onMoveDown={moveClipDown}
          onRemove={onRemoveClip}
        />
      ))}
    </section>
  );
}
