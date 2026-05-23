const acceptableUseTopics = [
  "Users are responsible for having rights to uploaded assets and for respecting provider and platform safety boundaries later.",
  "Template examples shown in the product shell are static sample content only, not generated output or moderation-approved deliverables.",
  "This page is draft-only and does not claim a final moderation or enforcement program is already live.",
] as const;

export function AcceptableUsePage() {
  return (
    <section className="legal-page" data-testid="acceptable-use-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 10</p>
          <h1>Acceptable use draft</h1>
          <p className="placeholder-description">
            This page outlines draft acceptable-use expectations for uploads,
            generated content, and BYOK responsibilities. It does not pretend a
            final moderation policy or report workflow is already active.
          </p>
        </div>

        <div className="status-callout">
          <span className="status-kicker">Legal state</span>
          <strong>Draft legal-readiness only</strong>
          <p>No final moderation policy, report queue, or enforcement SLA is claimed here.</p>
        </div>
      </div>

      <div className="page-section">
        <div className="placeholder-grid">
          {acceptableUseTopics.map((topic) => (
            <article key={topic} className="info-card">
              <p>{topic}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
