import { useEffect } from "react";
import { providerCapabilityLabels } from "../services/providerCapabilityLabels";
import { useProviderSettingsStore } from "../store/providerSettingsStore";
import { useNavigationStore } from "../store/navigationStore";

const productPolicyCards = [
  "BYOK means users pay provider generation cost through their own API keys later.",
  "Free BYOK users may later get 2500 daily Free AI Mixer platform credits.",
  "Multiple API keys do not multiply daily platform credits.",
  "Multiple providers only increase routing and fallback options.",
  "Templates, mixer, exports, and downloads will share one global credit wallet later.",
  "Audio is optional and provider-capability based, not a separate early setup.",
] as const;

export function ProviderSettingsPage() {
  const catalogStatus = useProviderSettingsStore((state) => state.catalogStatus);
  const catalogMessage = useProviderSettingsStore((state) => state.catalogMessage);
  const providers = useProviderSettingsStore((state) => state.providers);
  const accessStatus = useProviderSettingsStore((state) => state.accessStatus);
  const accessMessage = useProviderSettingsStore((state) => state.accessMessage);
  const routingPreferences = useProviderSettingsStore((state) => state.routingPreferences);
  const connections = useProviderSettingsStore((state) => state.connections);
  const pendingAction = useProviderSettingsStore((state) => state.pendingAction);
  const refreshProviderSettings = useProviderSettingsStore((state) => state.refreshProviderSettings);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  useEffect(() => {
    void refreshProviderSettings();
  }, [refreshProviderSettings]);

  return (
    <section className="provider-settings-page" data-testid="provider-settings-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 3</p>
          <h1>Provider settings and routing foundation</h1>
          <p className="placeholder-description">
            This page only reads backend-owned provider metadata and settings
            status. Secure API key connection, real provider validation, and
            routing execution are not enabled yet.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              onClick={() => {
                void refreshProviderSettings();
              }}
              disabled={pendingAction === "refresh"}
            >
              {pendingAction === "refresh" ? "Refreshing..." : "Refresh provider settings"}
            </button>
            {accessStatus === "authenticated" ? (
              <button
                type="button"
                className="secondary"
                onClick={() => navigateTo("/dashboard")}
              >
                Back to dashboard
              </button>
            ) : (
              <button
                type="button"
                className="secondary"
                onClick={() => navigateTo("/login")}
              >
                Go to login
              </button>
            )}
          </div>
        </div>

        <div className="status-callout" data-testid="provider-settings-access-state">
          <span className="status-kicker">Access status</span>
          <strong>{accessStatus}</strong>
          <p>{accessMessage}</p>
          {accessStatus === "unauthenticated" ? (
            <p>Sign in is required before provider settings can be managed.</p>
          ) : null}
          {accessStatus === "unavailable" ? (
            <p>Authentication is not configured on this backend yet.</p>
          ) : null}
          {accessStatus === "authenticated" ? (
            <p>Connection summaries stay read-only and unconnected in this phase.</p>
          ) : null}
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Supported providers</p>
          <h2>Catalog and capability metadata</h2>
        </div>
        <article className="info-card">
          <p>{catalogMessage}</p>
        </article>
        <div className="provider-card-grid" data-testid="provider-catalog-grid">
          {providers.map((provider) => (
            <article key={provider.id} className="provider-card">
              <p className="info-card-label">{provider.id}</p>
              <h3>{provider.displayName}</h3>
              <p>{provider.summary}</p>
              <div className="capability-chip-list">
                {provider.capabilities.map((capability) => (
                  <span
                    key={`${provider.id}-${capability}`}
                    className="capability-chip"
                    data-testid="provider-capability-chip"
                  >
                    {providerCapabilityLabels[capability]}
                  </span>
                ))}
              </div>
            </article>
          ))}
          {providers.length === 0 && catalogStatus !== "ready" ? (
            <article className="info-card">
              <h3>Provider catalog unavailable</h3>
              <p>The provider catalog could not be loaded from the backend boundary.</p>
            </article>
          ) : null}
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Routing policy</p>
          <h2>Future routing metadata only</h2>
        </div>
        <div className="placeholder-grid">
          <article className="info-card" data-testid="provider-routing-card">
            <h3>Default routing mode</h3>
            <p>
              Current default: <strong>{routingPreferences?.mode ?? "auto"}</strong>
            </p>
            <p>
              Supported preferences are manual, auto, cheapest, fastest, and
              highest quality.
            </p>
          </article>
          <article className="info-card" data-testid="provider-fallback-card">
            <h3>Fallback policy</h3>
            <p>
              Fallback is{" "}
              <strong>{routingPreferences?.fallback.enabled ? "enabled" : "disabled"}</strong>
              {" "}by default.
            </p>
            <p>Ordered fallback lists are supported later. No implicit multi-provider burning is allowed.</p>
          </article>
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Connection status</p>
          <h2>Read-only provider connection summaries</h2>
        </div>
        <div className="provider-card-grid">
          {connections.map((connection) => (
            <article
              key={connection.providerId}
              className="provider-card"
              data-testid={`provider-connection-${connection.providerId}`}
            >
              <p className="info-card-label">{connection.providerId}</p>
              <h3>{connection.status === "not_connected" ? "Not connected yet" : "Unavailable"}</h3>
              <p>{connection.maskedKeySummary ?? "Secure API key connection is not enabled yet."}</p>
              <p>
                Last validation status:{" "}
                <strong>{connection.lastValidationStatus ?? "not_enabled_yet"}</strong>
              </p>
            </article>
          ))}
          {connections.length === 0 ? (
            <article className="info-card" data-testid="provider-connection-empty-state">
              <h3>No provider connections are available yet</h3>
              <p>Secure API key connection is not enabled yet. Real provider validation is not enabled yet.</p>
            </article>
          ) : null}
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Policy notes</p>
          <h2>What this phase does and does not enable</h2>
        </div>
        <div className="note-grid">
          {productPolicyCards.map((card) => (
            <article key={card} className="info-card">
              <p>{card}</p>
            </article>
          ))}
          <article className="info-card">
            <p>Secure API key connection is not enabled yet.</p>
          </article>
          <article className="info-card">
            <p>Real provider validation is not enabled yet.</p>
          </article>
          <article className="info-card">
            <p>Routing execution is not enabled yet.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
