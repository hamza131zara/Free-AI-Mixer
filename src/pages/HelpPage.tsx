import { useNavigationStore } from "../store/navigationStore";

const faqCards = [
  {
    title: "BYOK provider setup",
    body:
      "Provider API key setup remains a backend-readiness topic. Users later connect their own keys and still pay provider generation cost through those keys.",
  },
  {
    title: "Export and downloads",
    body:
      "Downloads only become ready when the backend delivery descriptor says the artifact is verified, authorized, and safe for explicit user-triggered navigation.",
  },
  {
    title: "Credits and billing",
    body:
      "Credits and billing are still draft/readiness-only. No wallet balance, purchases, or subscriptions are enabled yet.",
  },
  {
    title: "Templates, mixer, and history flow",
    body:
      "Templates remain planning shells, Mixer is the live workbench, and History remains an honest account-history shell without invented downloads.",
  },
] as const;

export function HelpPage() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  return (
    <section className="help-page" data-testid="help-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 10</p>
          <h1>Help and support shell</h1>
          <p className="placeholder-description">
            This page provides truthful setup guidance and troubleshooting notes.
            It does not create tickets, fake a submitted support request, or
            promise a staff response.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => navigateTo("/onboarding")}>
              Review onboarding
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigateTo("/settings/providers")}
            >
              Review Provider Settings
            </button>
          </div>
        </div>

        <div className="status-callout" data-testid="help-status-card">
          <span className="status-kicker">Support state</span>
          <strong>Support shell only</strong>
          <p>No fake ticket ID, fake submitted state, or fake staff response exists here.</p>
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">FAQ</p>
          <h2>Truthful setup and readiness guidance</h2>
        </div>
        <div className="placeholder-grid">
          {faqCards.map((card) => (
            <article key={card.title} className="info-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="page-section note-grid">
        <article className="info-card">
          <p>Provider API key safety remains a backend-only concern. Frontend storage of provider secrets is not supported.</p>
        </article>
        <article className="info-card">
          <p>Support requests may later contain user data, so support workflows will need explicit privacy safeguards before they are enabled.</p>
        </article>
        <article className="info-card">
          <p>No real support ticket mutation or persistence is enabled in this phase.</p>
        </article>
      </div>
    </section>
  );
}
