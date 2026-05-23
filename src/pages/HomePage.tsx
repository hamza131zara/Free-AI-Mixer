import { primaryNavigationItems } from "../services/navigationService";
import { useNavigationStore } from "../store/navigationStore";

const featuredRouteIds = new Set(["mixer", "templates", "pricing"]);

export function HomePage() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const featuredRoutes = primaryNavigationItems.filter((route) =>
    featuredRouteIds.has(route.id),
  );

  return (
    <section className="marketing-page" data-testid="home-page">
      <div className="marketing-hero">
        <div className="marketing-copy">
          <p className="eyebrow">Product Phase 1</p>
          <h1>Free AI Mixer now has a real navigation shell.</h1>
          <p className="marketing-description">
            The existing mixer workbench stays available on its own route, while the
            rest of the SaaS surface is now mapped into honest product-boundary
            pages instead of pretending unfinished product modules already exist.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => navigateTo("/mixer")}>
              Open Mixer
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigateTo("/templates")}
            >
              Browse Templates
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigateTo("/pricing")}
            >
              Review Pricing Policy
            </button>
          </div>
        </div>
        <div className="info-card-grid">
          <article className="info-card">
            <p className="info-card-label">Current state</p>
            <h2>Workbench today</h2>
            <p>
              Scene generation, queueing, timeline editing, and export request flows
              remain on the Mixer route with their current honest behavior.
            </p>
          </article>
          <article className="info-card">
            <p className="info-card-label">Not enabled yet</p>
            <h2>SaaS modules later</h2>
            <p>
              Dashboard, templates, project history, provider settings, credits,
              billing, and real support/admin operations are coming in later
              product phases. Help and legal pages stay shell-only for now.
            </p>
          </article>
          <article className="info-card">
            <p className="info-card-label">BYOK note</p>
            <h2>Provider cost stays user-owned</h2>
            <p>
              BYOK users will pay provider generation cost through their own API
              keys. Future platform credits do not replace provider billing.
            </p>
          </article>
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Mapped routes</p>
          <h2>Product information architecture is now visible</h2>
        </div>
        <div className="route-card-grid">
          {featuredRoutes.map((route) => (
            <article key={route.id} className="route-card">
              <p className="route-card-path">{route.path}</p>
              <h3>{route.label}</h3>
              <p>{route.description}</p>
              <button type="button" className="secondary" onClick={() => navigateTo(route.path)}>
                Open {route.label}
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className="page-section note-grid">
        <article className="info-card">
          <p className="info-card-label">Platform credits</p>
          <p>
            Free BYOK users may later get 2500 daily Free AI Mixer platform credits.
            Multiple API keys do not multiply those daily credits.
          </p>
        </article>
        <article className="info-card">
          <p className="info-card-label">Templates wallet</p>
          <p>
            Templates will use the same global credit wallet as mixer, export, and
            approved download flows when those systems are enabled later.
          </p>
        </article>
        <article className="info-card">
          <p className="info-card-label">Onboarding flow</p>
          <p>
            A first-run onboarding shell can guide users from provider setup to
            templates, mixer, export, and history without inventing fake account or
            download state.
          </p>
        </article>
      </div>
    </section>
  );
}
