const retentionTopics = [
  "Free BYOK artifact and video retention may later be around 3 days, but that remains draft policy only in this phase.",
  "Metadata and history may later last longer, for example around 30 days, but no final retention commitment is made here.",
  "Production artifact delivery remains backend-gated and does not imply permanent storage or public access.",
] as const;

export function DataRetentionPage() {
  return (
    <section className="legal-page" data-testid="data-retention-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 10</p>
          <h1>Data retention draft</h1>
          <p className="placeholder-description">
            This page describes draft retention expectations only. It does not
            claim final cleanup automation, legal approval, or public-launch data
            retention policy readiness.
          </p>
        </div>

        <div className="status-callout">
          <span className="status-kicker">Legal state</span>
          <strong>Draft legal-readiness only</strong>
          <p>No final artifact-retention or deletion-policy claim is made here.</p>
        </div>
      </div>

      <div className="page-section">
        <div className="placeholder-grid">
          {retentionTopics.map((topic) => (
            <article key={topic} className="info-card">
              <p>{topic}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
