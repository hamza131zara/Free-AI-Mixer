const cookieTopics = [
  "Browser-local storage may be used for editor convenience such as reconnect state, but it must not become account, admin, or credit truth.",
  "This page does not claim a final consent-management implementation or regional cookie-compliance rollout.",
  "Sensitive provider keys, service-role values, and backend-only secrets must never be stored in the frontend.",
] as const;

export function CookiesPage() {
  return (
    <section className="legal-page" data-testid="cookies-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 10</p>
          <h1>Cookies and local storage draft</h1>
          <p className="placeholder-description">
            This page explains draft browser-storage and cookie-readiness topics
            only. It does not claim a final consent banner or regional compliance
            implementation exists yet.
          </p>
        </div>

        <div className="status-callout">
          <span className="status-kicker">Legal state</span>
          <strong>Draft legal-readiness only</strong>
          <p>No final cookie-consent, regional compliance, or launch-ready policy claim is made here.</p>
        </div>
      </div>

      <div className="page-section">
        <div className="placeholder-grid">
          {cookieTopics.map((topic) => (
            <article key={topic} className="info-card">
              <p>{topic}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
