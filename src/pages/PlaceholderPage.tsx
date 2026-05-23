import { selectCurrentRoute, useNavigationStore } from "../store/navigationStore";

export function PlaceholderPage() {
  const currentRoute = useNavigationStore(selectCurrentRoute);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  return (
    <section
      className="placeholder-page"
      data-testid={`${currentRoute.id}-page`}
    >
      <div className="placeholder-hero">
        <div>
          <p className="eyebrow">{currentRoute.eyebrow}</p>
          <h1>{currentRoute.title}</h1>
          <p className="placeholder-description">{currentRoute.description}</p>
        </div>
        <div className="status-callout">
          <span className="status-kicker">Status</span>
          <strong>{currentRoute.status}</strong>
          <p>Missing product features stay clearly marked as not enabled yet.</p>
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Product honesty</p>
          <h2>This route is a placeholder by design</h2>
        </div>
        <div className="placeholder-grid">
          {currentRoute.sections.map((section) => (
            <article key={section.title} className="info-card">
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="page-section quick-links">
        <button type="button" onClick={() => navigateTo("/mixer")}>
          Go to Mixer workbench
        </button>
        <button type="button" className="secondary" onClick={() => navigateTo("/")}>
          Return Home
        </button>
      </div>
    </section>
  );
}
