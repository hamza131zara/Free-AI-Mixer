const privacyTopics = [
  "BYOK provider cost stays user-owned and separate from future platform credits.",
  "Provider API key privacy handling remains draft/readiness-only until secure backend key workflows are enabled later.",
  "This product currently avoids frontend Supabase/storage access and keeps signed delivery backend-mediated.",
] as const;

export function PrivacyPage() {
  return (
    <section className="legal-page" data-testid="privacy-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 10</p>
          <h1>Privacy policy draft</h1>
          <p className="placeholder-description">
            This page is a legal-readiness draft only. It does not claim final
            legal approval, regional compliance certification, or production launch
            review completion.
          </p>
        </div>

        <div className="status-callout">
          <span className="status-kicker">Legal state</span>
          <strong>Draft legal-readiness only</strong>
          <p>No lawyer-approved claim or final compliance badge is presented here.</p>
        </div>
      </div>

      <div className="page-section">
        <div className="placeholder-grid">
          {privacyTopics.map((topic) => (
            <article key={topic} className="info-card">
              <p>{topic}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
