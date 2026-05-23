import { useNavigationStore } from "../store/navigationStore";

const onboardingSteps = [
  {
    title: "1. Review BYOK provider setup",
    body:
      "Provider setup stays separate from generation. Users later connect their own API keys and still pay provider generation cost through those keys in BYOK mode.",
  },
  {
    title: "2. Understand platform credits",
    body:
      "Platform credits meter Free AI Mixer orchestration, storage, render, and download-related work later. Multiple API keys do not multiply daily platform credits.",
  },
  {
    title: "3. Choose a template or start in Mixer",
    body:
      "Templates will later prepare structured inputs for the same backend generation and render system. The Mixer route remains the live workbench today.",
  },
  {
    title: "4. Export and wait for verified delivery",
    body:
      "Downloads only become ready when the backend descriptor says the artifact is verified, authorized, and ready for explicit user-triggered delivery.",
  },
] as const;

export function OnboardingPage() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  return (
    <section className="onboarding-page" data-testid="onboarding-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 9</p>
          <h1>First-run onboarding shell</h1>
          <p className="placeholder-description">
            This onboarding route explains how provider setup, credits, templates,
            mixer generation, exports, and history fit together. It does not fake
            account completion, connected providers, balances, or ready downloads.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => navigateTo("/templates")}>
              Browse templates
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigateTo("/mixer")}
            >
              Open Mixer
            </button>
          </div>
        </div>

        <div className="status-callout" data-testid="onboarding-status-card">
          <span className="status-kicker">Onboarding state</span>
          <strong>Planning shell only</strong>
          <p>BYOK provider setup, credits, and downloads stay honest here.</p>
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Core flow</p>
          <h2>How the product is intended to work later</h2>
        </div>
        <div className="placeholder-grid">
          {onboardingSteps.map((step) => (
            <article key={step.title} className="info-card">
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="page-section note-grid">
        <article className="info-card">
          <p>BYOK provider cost stays separate from Free AI Mixer platform credits.</p>
        </article>
        <article className="info-card">
          <p>Multiple API keys do not multiply daily platform credits.</p>
        </article>
        <article className="info-card">
          <p>No fake connected provider, fake balance, or fake download is shown here.</p>
        </article>
      </div>

      <div className="page-section quick-links">
        <button type="button" onClick={() => navigateTo("/settings/providers")}>
          Review Provider Settings
        </button>
        <button type="button" className="secondary" onClick={() => navigateTo("/credits")}>
          Review Credits Policy
        </button>
        <button type="button" className="secondary" onClick={() => navigateTo("/history")}>
          Review History Shell
        </button>
      </div>
    </section>
  );
}
