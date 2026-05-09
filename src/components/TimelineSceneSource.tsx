import { useShallow } from "zustand/react/shallow";
import { useSceneStore } from "../store/sceneStore";
import {
  selectCanAddSceneToTimeline,
  useTimelineStore,
} from "../store/timelineStore";
import type { TimelineId } from "../types/timeline";

interface TimelineSceneSourceProps {
  activeTimelineId?: TimelineId;
}

export function TimelineSceneSource({ activeTimelineId }: TimelineSceneSourceProps) {
  const addSceneClip = useTimelineStore((state) => state.addSceneClip);
  const successfulScenes = useSceneStore(
    useShallow((state) =>
      state.scenes.filter((scene) => scene.lifecycle === "success"),
    ),
  );

  if (!activeTimelineId) {
    return (
      <section className="scene-queue scene-queue-empty" data-testid="timeline-scene-source">
        <p>Create a timeline first to add scenes.</p>
      </section>
    );
  }

  if (successfulScenes.length === 0) {
    return (
      <section className="scene-queue scene-queue-empty" data-testid="timeline-scene-source">
        <p>No successful scenes available to add yet.</p>
      </section>
    );
  }

  return (
    <section className="scene-queue" data-testid="timeline-scene-source">
      <p className="scene-stage-note">Scene Sources</p>
      {successfulScenes.map((scene) => {
        const canAdd = selectCanAddSceneToTimeline(
          useTimelineStore.getState(),
          scene.id,
        );

        return (
          <article className="scene-card" key={scene.id}>
            <div className="scene-card-header">
              <span className="status-pill status-success">success</span>
              <div className="scene-card-actions">
                <button
                  type="button"
                  onClick={() => addSceneClip(activeTimelineId, scene.id)}
                  disabled={!canAdd}
                  aria-label={`Add scene ${scene.id} to timeline`}
                >
                  Add to timeline
                </button>
              </div>
            </div>
            <p className="scene-prompt">{scene.payload.prompt}</p>
            <dl className="scene-meta">
              <div>
                <dt>Scene ID</dt>
                <dd>{scene.id}</dd>
              </div>
            </dl>
          </article>
        );
      })}
    </section>
  );
}
