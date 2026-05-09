import type { TimelineClip, TimelineId } from "../types/timeline";

interface TimelineClipItemProps {
  timelineId: TimelineId;
  clip: TimelineClip;
  isSelected: boolean;
  onSelect: (timelineId: TimelineId, clipId?: string) => void;
  onRemove: (timelineId: TimelineId, clipId: string) => void;
}

export function TimelineClipItem({
  timelineId,
  clip,
  isSelected,
  onSelect,
  onRemove,
}: TimelineClipItemProps) {
  return (
    <article className="scene-card">
      <div className="scene-card-header">
        <span className={`status-pill ${isSelected ? "status-success" : "status-idle"}`}>
          Clip {clip.order + 1}
        </span>
        <div className="scene-card-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => onSelect(timelineId, clip.id)}
            aria-label="Select clip"
            title="Select clip"
          >
            Select
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => onRemove(timelineId, clip.id)}
            aria-label="Remove clip"
            title="Remove clip"
          >
            Remove
          </button>
        </div>
      </div>
      <dl className="scene-meta">
        <div>
          <dt>Label</dt>
          <dd>{clip.label || "Untitled clip"}</dd>
        </div>
        <div>
          <dt>Scene ID</dt>
          <dd>{clip.sceneId}</dd>
        </div>
        <div>
          <dt>Start</dt>
          <dd>{clip.startMs}ms</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{clip.durationMs}ms</dd>
        </div>
      </dl>
    </article>
  );
}

