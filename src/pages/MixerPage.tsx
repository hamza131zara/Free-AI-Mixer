import { SceneComposer } from "../components/SceneComposer";
import { SceneQueue } from "../components/SceneQueue";
import { SceneStatus } from "../components/SceneStatus";
import { PromptImageGenerator } from "../components/PromptImageGenerator";
import { PromptImageHistory } from "../components/PromptImageHistory";
import { PromptVideoGenerator } from "../components/PromptVideoGenerator";
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
          <div className="workspace-stack">
            <SceneComposer />
            <PromptImageGenerator />
            <PromptVideoGenerator />
            <PromptImageHistory />
          </div>
          <SceneQueue />
        </div>
      </section>
      <TimelinePanel />
    </main>
  );
}
