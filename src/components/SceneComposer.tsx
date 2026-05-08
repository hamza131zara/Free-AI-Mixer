import { ListPlus, Play } from "lucide-react";
import { useSceneStore } from "../store/sceneStore";
import {
  selectCanAddScene,
  selectCanGenerateAll,
  selectComposerError,
  selectDraft,
  selectHasHydrated,
} from "../store/sceneSelectors";

const styleOptions = [
  "",
  "cinematic",
  "product",
  "architectural",
  "character",
  "surreal",
] as const;

export function SceneComposer() {
  const draft = useSceneStore(selectDraft);
  const hasHydrated = useSceneStore(selectHasHydrated);
  const composerError = useSceneStore(selectComposerError);
  const canAddScene = useSceneStore(selectCanAddScene);
  const canGenerateAll = useSceneStore(selectCanGenerateAll);
  const updateDraft = useSceneStore((state) => state.updateDraft);
  const addSceneFromDraft = useSceneStore((state) => state.addSceneFromDraft);
  const generateAll = useSceneStore((state) => state.generateAll);

  return (
    <form
      className="scene-composer"
      onSubmit={(event) => {
        event.preventDefault();
        addSceneFromDraft();
      }}
    >
      <label className="field field-wide">
        <span>Prompt</span>
        <textarea
          disabled={!hasHydrated}
          value={draft.prompt}
          onChange={(event) => updateDraft({ prompt: event.target.value })}
          placeholder="A glass observatory above a storm-lit ocean"
          rows={6}
        />
      </label>

      <label className="field">
        <span>Style</span>
        <select
          disabled={!hasHydrated}
          value={draft.style}
          onChange={(event) => updateDraft({ style: event.target.value })}
        >
          {styleOptions.map((style) => (
            <option key={style || "default"} value={style}>
              {style || "Default"}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Duration</span>
        <input
          disabled={!hasHydrated}
          value={draft.duration}
          onChange={(event) => updateDraft({ duration: event.target.value })}
          inputMode="decimal"
          placeholder="Optional seconds"
        />
      </label>

      {composerError ? (
        <p className="composer-error field-wide">{composerError.message}</p>
      ) : null}

      <div className="actions">
        <button type="submit" disabled={!canAddScene}>
          <ListPlus aria-hidden="true" size={18} />
          Add Scene
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => void generateAll()}
          disabled={!canGenerateAll}
        >
          <Play aria-hidden="true" size={18} />
          Generate All
        </button>
      </div>
    </form>
  );
}
