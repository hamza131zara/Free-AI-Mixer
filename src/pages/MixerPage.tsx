import { SceneComposer } from "../components/SceneComposer";
import { SceneQueue } from "../components/SceneQueue";
import { SceneStatus } from "../components/SceneStatus";
import { TimelinePanel } from "../components/TimelinePanel";

export function MixerPage() {
  return (
    <main className="app-shell" data-testid="mixer-page">
      <section className="workspace">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">AI Scene Generation</p>
            <h1>Free AI Mixer</h1>
          </div>
        </div>
        <SceneStatus />
        <div className="workspace-grid">
          <SceneComposer />
          <SceneQueue />
        </div>
      </section>
      <TimelinePanel />
    </main>
  );
}
