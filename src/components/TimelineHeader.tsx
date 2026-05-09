import type { Timeline, TimelineId } from "../types/timeline";

interface TimelineHeaderProps {
  timelines: Timeline[];
  activeTimelineId?: TimelineId;
  onCreateTimeline: (name?: string) => void;
  onSetActiveTimeline: (timelineId: TimelineId) => void;
  onRenameTimeline: (timelineId: TimelineId, name: string) => void;
  onRemoveTimeline: (timelineId: TimelineId) => void;
}

export function TimelineHeader({
  timelines,
  activeTimelineId,
  onCreateTimeline,
  onSetActiveTimeline,
  onRenameTimeline,
  onRemoveTimeline,
}: TimelineHeaderProps) {
  if (timelines.length === 0) {
    return (
      <section className="scene-status">
        <div>
          <p className="scene-stage-note">No timeline created yet.</p>
        </div>
        <button type="button" onClick={() => onCreateTimeline()}>
          Create Timeline
        </button>
      </section>
    );
  }

  const activeTimeline =
    timelines.find((timeline) => timeline.id === activeTimelineId) ?? timelines[0];

  return (
    <section className="scene-status">
      <div className="status-metrics">
        <span>Timelines {timelines.length}</span>
        <span>Active {activeTimeline?.name ?? "None"}</span>
      </div>
      <div className="scene-card-actions">
        <select
          value={activeTimeline?.id}
          onChange={(event) => onSetActiveTimeline(event.target.value)}
          aria-label="Select timeline"
        >
          {timelines.map((timeline) => (
            <option key={timeline.id} value={timeline.id}>
              {timeline.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => onCreateTimeline()}>
          New
        </button>
        {activeTimeline ? (
          <>
            <button
              type="button"
              onClick={() =>
                onRenameTimeline(
                  activeTimeline.id,
                  `${activeTimeline.name} Updated`,
                )
              }
            >
              Rename
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => onRemoveTimeline(activeTimeline.id)}
            >
              Remove
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}

