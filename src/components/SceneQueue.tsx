import { Play, RotateCcw, Trash2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useSceneStore } from "../store/sceneStore";
import { selectSceneViewModels } from "../store/sceneSelectors";

export function SceneQueue() {
  const scenes = useSceneStore(useShallow(selectSceneViewModels));
  const generateScene = useSceneStore((state) => state.generateScene);
  const retryScene = useSceneStore((state) => state.retryScene);
  const selectVariation = useSceneStore((state) => state.selectVariation);
  const removeScene = useSceneStore((state) => state.removeScene);

  if (scenes.length === 0) {
    return (
      <section className="scene-queue scene-queue-empty">
        <p>No scenes queued yet.</p>
      </section>
    );
  }

  return (
    <section className="scene-queue">
      {scenes.map((scene) => (
        <article className="scene-card" key={scene.id}>
          <div className="scene-card-header">
            <span className={`status-pill status-${scene.lifecycle}`}>
              {scene.lifecycle}
            </span>
            <div className="scene-card-actions">
              {scene.canGenerate ? (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => void generateScene(scene.id)}
                  aria-label="Generate scene"
                  title="Generate scene"
                >
                  <Play aria-hidden="true" size={16} />
                </button>
              ) : null}
              {scene.canRetry ? (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => void retryScene(scene.id)}
                  aria-label="Retry scene"
                  title="Retry scene"
                >
                  <RotateCcw aria-hidden="true" size={16} />
                </button>
              ) : null}
              <button
                type="button"
                className="icon-button"
                onClick={() => removeScene(scene.id)}
                disabled={!scene.canRemove}
                aria-label="Remove scene"
                title="Remove scene"
              >
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </div>
          </div>

          <p className="scene-prompt">{scene.prompt}</p>

          <dl className="scene-meta">
            <div>
              <dt>Style</dt>
              <dd>{scene.style}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{scene.duration}</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>{scene.provider}</dd>
            </div>
            <div>
              <dt>Progress</dt>
              <dd>{scene.progressLabel}</dd>
            </div>
          </dl>

          {scene.error ? <p className="error-message">{scene.error}</p> : null}

          {scene.image ? (
            <div className="scene-output">
              <img src={scene.image} alt={scene.prompt} className="scene-image" />
              {scene.variations.length > 0 ? (
                <div className="variation-strip">
                  {scene.variations.map((variation) => (
                    <button
                      type="button"
                      key={variation}
                      className={
                        variation === scene.selectedVariation
                          ? "variation-button selected"
                          : "variation-button"
                      }
                      onClick={() => selectVariation(scene.id, variation)}
                      disabled={!scene.canSelectVariation}
                      aria-label="Select variation"
                      title="Select variation"
                    >
                      <img
                        src={variation}
                        alt={scene.prompt}
                        className="variation-image"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}
