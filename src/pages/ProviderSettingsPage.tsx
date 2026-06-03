import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { providerCapabilityLabels } from "../services/providerCapabilityLabels";
import { useProviderSettingsStore } from "../store/providerSettingsStore";
import { useNavigationStore } from "../store/navigationStore";
import type { SupportedProviderId } from "../types/providerSettings";

const productPolicyCards = [
  "Bring your own API key to use your provider balance or free trial credits through Free AI Mixer later.",
  "BYOK means users pay provider generation cost through their own API keys later.",
  "Provider balance and credits belong to the user’s provider account. Free AI Mixer does not grant or multiply provider credits.",
  "Free AI Mixer platform credits and limits are separate from provider usage.",
  "Adding multiple API keys does not multiply platform credits.",
  "Multiple API keys do not multiply daily platform credits.",
  "Multiple provider keys only add more provider options, capabilities, and fallback choices.",
  "Multiple providers only increase routing and fallback options.",
  "Fallback may use additional provider balance only if fallback is explicitly enabled.",
  "Templates, mixer, exports, storage, downloads, and queue priority may later share one global Free AI Mixer platform wallet.",
  "Audio is optional and provider-capability based, not a separate early setup.",
] as const;

const providerActionLabels = [
  "Add key",
  "Replace key",
  "Remove key",
  "Test connection unavailable",
] as const;

export function ProviderSettingsPage() {
  const catalogStatus = useProviderSettingsStore((state) => state.catalogStatus);
  const catalogMessage = useProviderSettingsStore((state) => state.catalogMessage);
  const providers = useProviderSettingsStore((state) => state.providers);
  const accessStatus = useProviderSettingsStore((state) => state.accessStatus);
  const accessMessage = useProviderSettingsStore((state) => state.accessMessage);
  const routingPreferences = useProviderSettingsStore((state) => state.routingPreferences);
  const connections = useProviderSettingsStore((state) => state.connections);
  const mutationMessage = useProviderSettingsStore((state) => state.mutationMessage);
  const mutationStatus = useProviderSettingsStore((state) => state.mutationStatus);
  const pendingAction = useProviderSettingsStore((state) => state.pendingAction);
  const refreshProviderSettings = useProviderSettingsStore((state) => state.refreshProviderSettings);
  const replaceProviderConnection = useProviderSettingsStore((state) => state.replaceProviderConnection);
  const revokeProviderConnection = useProviderSettingsStore((state) => state.revokeProviderConnection);
  const saveProviderConnection = useProviderSettingsStore((state) => state.saveProviderConnection);
  const testProviderConnection = useProviderSettingsStore((state) => state.testProviderConnection);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const keyFormRef = useRef<HTMLFormElement | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<SupportedProviderId | "">("");

  useEffect(() => {
    void refreshProviderSettings();
  }, [refreshProviderSettings]);

  useEffect(() => {
    if (selectedProviderId || providers.length === 0) {
      return;
    }

    setSelectedProviderId(providers[0].id);
  }, [providers, selectedProviderId]);

  const selectedConnection = selectedProviderId
    ? connections.find((connection) => connection.providerId === selectedProviderId)
    : undefined;
  const selectedProvider = selectedProviderId
    ? providers.find((provider) => provider.id === selectedProviderId)
    : undefined;
  const hasStoredSummary = Boolean(
    selectedConnection?.canManage &&
      (selectedConnection.maskedFingerprint ||
        selectedConnection.keyFingerprintSuffix ||
        selectedConnection.createdAt),
  );
  const canShowKeyForm =
    accessStatus === "authenticated" && providers.length > 0 && selectedProviderId !== "";
  const isMutating =
    pendingAction === "save" ||
    pendingAction === "replace" ||
    pendingAction === "revoke" ||
    pendingAction === "test";

  const handleKeySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedProviderId) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const apiKey = String(formData.get("apiKey") ?? "").trim();
    form.reset();

    if (!apiKey) {
      return;
    }

    void (hasStoredSummary
      ? replaceProviderConnection(selectedProviderId, apiKey)
      : saveProviderConnection(selectedProviderId, apiKey));
  };

  const handleRevoke = () => {
    if (!selectedProviderId || !hasStoredSummary) {
      return;
    }

    keyFormRef.current?.reset();
    void revokeProviderConnection(selectedProviderId);
  };

  const handleValidation = () => {
    if (!selectedProviderId || !hasStoredSummary) {
      return;
    }

    keyFormRef.current?.reset();
    void testProviderConnection(selectedProviderId);
  };

  return (
    <section className="provider-settings-page" data-testid="provider-settings-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 14</p>
          <h1>Secure BYOK provider settings readiness</h1>
          <p className="placeholder-description">
            This page reads backend-owned provider metadata, connection summaries,
            and routing policy readiness only. Secure API key storage, live
            provider validation, and execution are still disabled in this phase.
          </p>
          <p className="placeholder-description">
            Provider key setup is not enabled in this beta. API key input, save,
            replace, remove, and verification flows require future encrypted
            backend storage before they can become live.
          </p>
          <p className="placeholder-description">
            Limited BYOK key storage can be enabled only when the authenticated
            backend route gate, workspace authorization, repository, and vault
            are configured. Provider validation and generation routing remain
            disabled.
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
          {accessStatus === "forbidden" ? (
            <p>Workspace access is required before this page can show backend-owned data.</p>
          ) : null}
          {accessStatus === "unavailable" ? (
            <p>
              {accessMessage.includes("Workspace authority")
                ? "Workspace authority is not configured on this backend yet."
                : "Authentication is not configured on this backend yet."}
            </p>
          ) : null}
          {accessStatus === "authenticated" ? (
            <p>Connection summaries stay metadata-only and not_connected until secure backend key storage exists.</p>
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
              <p>
                <strong>Status:</strong> {provider.status}
              </p>
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
              <p>
                <strong>Provider cost:</strong> {provider.costNote}
              </p>
              <p>
                <strong>Platform policy:</strong> {provider.platformLimitNote}
              </p>
              <p>
                <strong>Security note:</strong> {provider.securityNote}
              </p>
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
          <h2>Manual, priority, auto, and fallback readiness</h2>
        </div>
        <div className="placeholder-grid">
          <article className="info-card" data-testid="provider-routing-card">
            <h3>Default routing mode</h3>
            <p>
              Current default: <strong>{routingPreferences?.mode ?? "auto"}</strong>
            </p>
            <p>
              Supported routing modes are manual, priority, and auto. Routing stays
              single-provider-per-attempt only.
            </p>
          </article>
          <article className="info-card" data-testid="provider-fallback-card">
            <h3>Fallback policy</h3>
            <p>
              Fallback is{" "}
              <strong>{routingPreferences?.fallback.enabled ? "enabled" : "disabled"}</strong>
              {" "}by default.
            </p>
            <p>
              Fallback requires explicit opt-in. Ordered fallback lists are supported later,
              and the platform must never fan out to all providers at once.
            </p>
          </article>
          <article className="info-card">
            <h3>Recommended video priority</h3>
            <p>{routingPreferences?.recommendedVideoPriority.join(" → ")}</p>
          </article>
          <article className="info-card">
            <h3>Recommended image/card/template priority</h3>
            <p>{routingPreferences?.recommendedImagePriority.join(" → ")}</p>
          </article>
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Connection status</p>
          <h2>Read-only provider connection summaries</h2>
        </div>
        {canShowKeyForm ? (
          <article className="info-card provider-key-form-card" data-testid="provider-key-form-card">
            <div className="section-header compact-section-header">
              <p className="eyebrow">Backend encrypted storage</p>
              <h3>Manage a provider key</h3>
            </div>
            <p>
              The key is sent only to the backend over the authenticated same-origin
              route. It is not stored in the browser, not written to
              localStorage/sessionStorage, and not shown again after submit.
            </p>
            <p>
              Stored keys are encrypted server-side. Provider validation may
              remain unavailable unless backend mock/local validation is
              explicitly configured.
            </p>
            <p>
              Validation uses the stored backend key reference only. No key is
              sent from the browser.
            </p>
            <form
              ref={keyFormRef}
              className="provider-key-form"
              data-testid="provider-key-form"
              onSubmit={handleKeySubmit}
            >
              <label htmlFor="provider-key-provider">Provider</label>
              <select
                id="provider-key-provider"
                data-testid="provider-key-provider-select"
                value={selectedProviderId}
                onChange={(event) =>
                  setSelectedProviderId(event.target.value as SupportedProviderId)
                }
              >
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.displayName}
                  </option>
                ))}
              </select>

              <label htmlFor="provider-key-input">API key</label>
              <input
                id="provider-key-input"
                name="apiKey"
                type="password"
                autoComplete="off"
                data-testid="provider-key-input"
                placeholder="Paste provider key for backend encrypted storage"
                required
              />
              <p className="form-helper">
                {selectedProvider
                  ? `${selectedProvider.displayName} provider costs remain billed to your provider account.`
                  : "Provider costs remain separate from Free AI Mixer credits."}
              </p>

              <div className="hero-actions">
                <button type="submit" disabled={isMutating}>
                  {pendingAction === "save" || pendingAction === "replace"
                    ? "Saving..."
                    : hasStoredSummary
                      ? "Replace key"
                      : "Save key"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={!hasStoredSummary || isMutating}
                  onClick={handleRevoke}
                >
                  {pendingAction === "revoke" ? "Removing..." : "Remove key"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={!hasStoredSummary || isMutating}
                  onClick={handleValidation}
                >
                  {pendingAction === "test"
                    ? "Validating..."
                    : hasStoredSummary
                      ? "Validate stored key"
                      : "Store key before validation"}
                </button>
              </div>
            </form>
            {mutationMessage ? (
              <div className="status-callout" data-testid="provider-key-mutation-message">
                <span className="status-kicker">Provider key update</span>
                <strong>{mutationStatus ?? "mutation_unavailable"}</strong>
                <p>{mutationMessage}</p>
              </div>
            ) : null}
            {selectedConnection ? (
              <div className="status-callout" data-testid="provider-key-redacted-summary">
                <span className="status-kicker">Redacted backend summary</span>
                <strong>
                  {selectedConnection.verificationStatus === "validated"
                    ? "Validated by backend"
                    : hasStoredSummary
                    ? "Stored server-side, not validated yet."
                    : "Not connected yet."}
                </strong>
                <p>{selectedConnection.maskedKeySummary ?? "No stored key summary yet."}</p>
                {selectedConnection.maskedFingerprint ? (
                  <p>Masked fingerprint: {selectedConnection.maskedFingerprint}</p>
                ) : null}
                {selectedConnection.keyFingerprintSuffix ? (
                  <p>Suffix: {selectedConnection.keyFingerprintSuffix}</p>
                ) : null}
                <p>
                  Verification status:{" "}
                  <strong>
                    {selectedConnection.verificationStatus ?? "not_validated"}
                  </strong>
                </p>
                <p>
                  Needs reverification:{" "}
                  <strong>{selectedConnection.needsReverification ? "yes" : "no"}</strong>
                </p>
              </div>
            ) : null}
          </article>
        ) : null}
        <div className="provider-card-grid">
          {connections.map((connection) => (
            <article
              key={connection.providerId}
              className="provider-card"
              data-testid={`provider-connection-${connection.providerId}`}
            >
              <p className="info-card-label">{connection.providerId}</p>
              <h3>
                {connection.status === "stored"
                  ? "Stored server-side"
                  : connection.status === "not_connected"
                    ? "Not connected yet"
                    : "Unavailable"}
              </h3>
              <p>{connection.maskedKeySummary ?? "Secure API key connection is not enabled yet."}</p>
              <p>
                Last validation status:{" "}
                <strong>{connection.lastValidationStatus ?? "not_enabled_yet"}</strong>
              </p>
              {connection.maskedFingerprint ? (
                <p>
                  <strong>Masked fingerprint:</strong> {connection.maskedFingerprint}
                </p>
              ) : null}
              {connection.keyFingerprintSuffix ? (
                <p>
                  <strong>Suffix:</strong> {connection.keyFingerprintSuffix}
                </p>
              ) : null}
              <p>
                Verification status:{" "}
                <strong>{connection.verificationStatus ?? "not_enabled_yet"}</strong>
              </p>
              <p>
                Needs reverification:{" "}
                <strong>{connection.needsReverification ? "yes" : "no"}</strong>
              </p>
              <p>
                Keys will later be encrypted backend-side, never shown again after
                submission, and never stored in the browser.
              </p>
              <div className="hero-actions">
                {providerActionLabels.map((label) => (
                  <button key={`${connection.providerId}-${label}`} type="button" className="secondary" disabled>
                    {label}
                  </button>
                ))}
              </div>
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
          <article className="info-card">
            <p>API key fields are not persisted in localStorage or sessionStorage in this product phase.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
