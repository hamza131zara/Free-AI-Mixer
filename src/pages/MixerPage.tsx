import { SceneComposer } from "../components/SceneComposer";
import { SceneQueue } from "../components/SceneQueue";
import { SceneStatus } from "../components/SceneStatus";
import { PromptImageGenerator } from "../components/PromptImageGenerator";
import { PromptImageHistory } from "../components/PromptImageHistory";
import { PromptVideoGenerator } from "../components/PromptVideoGenerator";
import { TimelinePanel } from "../components/TimelinePanel";
import { platformGenerationPolicyCopy } from "../services/providerCapabilityPolicyService";

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
            <section
              className="generation-workbench"
              aria-labelledby="generation-workbench-title"
            >
              <div className="generation-workbench-header">
                <div>
                  <p className="eyebrow">Mock generation lab</p>
                  <h2 id="generation-workbench-title">Prompt generation workspace</h2>
                  <p>
                    Generate backend-verified image metadata, review local history,
                    and inspect the video boundary without previews, downloads, or
                    provider calls.
                  </p>
                </div>
                <span className="status-pill status-idle">Metadata only</span>
              </div>
              <div
                className="generation-policy-banner"
                data-testid="generation-policy-banner"
              >
                <p>{platformGenerationPolicyCopy.freeWorkspaceCopy}</p>
                <p>{platformGenerationPolicyCopy.byokQuotaCopy}</p>
                <p>{platformGenerationPolicyCopy.providerBillingCopy}</p>
                <p>{platformGenerationPolicyCopy.paidPlatformCopy}</p>
              </div>
              <div className="generation-workbench-grid">
                <PromptImageGenerator />
                <PromptVideoGenerator />
              </div>
              <PromptImageHistory />
            </section>
          </div>
          <SceneQueue />
        </div>
      </section>
      <TimelinePanel />
    </main>
  );
}
