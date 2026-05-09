import { SceneComposer } from "./components/SceneComposer";
import { SceneQueue } from "./components/SceneQueue";
import { SceneStatus } from "./components/SceneStatus";
import { TimelinePanel } from "./components/TimelinePanel";

export function App() {
  return (
    <main className="app-shell">
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
