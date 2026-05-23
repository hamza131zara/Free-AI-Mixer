const termsTopics = [
  "Credits and billing remain draft/readiness-only and are not final business commitments.",
  "Generated content, uploaded assets, and provider usage will require clearer user responsibility language before public launch.",
  "This page does not create legal acceptance or pretend a final contract already exists.",
] as const;

export function TermsPage() {
  return (
    <section className="legal-page" data-testid="terms-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 10</p>
          <h1>Terms draft</h1>
          <p className="placeholder-description">
            This page is a draft legal-readiness surface only. It stays aligned to
            current product behavior and does not overclaim final launch, billing,
            or compliance commitments.
          </p>
        </div>

        <div className="status-callout">
          <span className="status-kicker">Legal state</span>
          <strong>Draft legal-readiness only</strong>
          <p>No final public contract or launch-ready terms acceptance is shown here.</p>
        </div>
      </div>

      <div className="page-section">
        <div className="placeholder-grid">
          {termsTopics.map((topic) => (
            <article key={topic} className="info-card">
              <p>{topic}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
