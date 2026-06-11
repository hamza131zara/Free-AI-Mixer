import { useEffect } from "react";
import { useCreditsStore } from "../store/creditsStore";
import { useNavigationStore } from "../store/navigationStore";

const reservedLifecycleNotes = [
  "Jobs should reserve credits first.",
  "Credits should settle only after truthful provider or render success.",
  "Failed, canceled, or unused reservations should release or refund credits instead of burning them silently.",
] as const;

export function CreditsPage() {
  const policy = useCreditsStore((state) => state.policy);
  const policyMessage = useCreditsStore((state) => state.policyMessage);
  const accessStatus = useCreditsStore((state) => state.accessStatus);
  const accessMessage = useCreditsStore((state) => state.accessMessage);
  const wallet = useCreditsStore((state) => state.wallet);
  const pendingAction = useCreditsStore((state) => state.pendingAction);
  const refreshCredits = useCreditsStore((state) => state.refreshCredits);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  useEffect(() => {
    void refreshCredits();
  }, [refreshCredits]);

  return (
    <section className="credits-page" data-testid="credits-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 8</p>
          <h1>Credits are not enabled yet</h1>
          <p className="placeholder-description">
            This page only shows planned credit policy and backend-owned readiness
            status. It does not fabricate a balance, refill action, purchase flow,
            subscription, or premium entitlement.
          </p>
          <p className="placeholder-description">
            Credits are planning-only in this beta. No live balance, refill,
            billing, checkout, subscription, or ledger mutation exists yet.
          </p>
          <p className="placeholder-description">
            Block 3 prepares backend-owned wallet, ledger, reservation, settlement,
            release, and refund boundaries for future platform-paid generation.
            It still does not charge users or fake credit purchases.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              onClick={() => {
                void refreshCredits();
              }}
              disabled={pendingAction === "refresh"}
            >
              {pendingAction === "refresh" ? "Refreshing..." : "Refresh credit policy"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigateTo("/pricing")}
            >
              Review pricing draft
            </button>
          </div>
        </div>

        <div className="status-callout" data-testid="credits-status-card">
          <span className="status-kicker">Wallet status</span>
          <strong>{accessStatus}</strong>
          <p>{accessMessage}</p>
          {wallet ? (
            <>
              <p>{wallet.message}</p>
              {wallet.liveBalanceAvailable && typeof wallet.balance === "number" ? (
                <p>
                  Live platform credit balance: <strong>{wallet.balance}</strong>
                </p>
              ) : (
                <p>No live platform credit balance is available yet.</p>
              )}
            </>
          ) : (
            <p>No live credit balance, ledger, or remaining-credit value is shown in this phase.</p>
          )}
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Platform policy</p>
          <h2>Global wallet rules stay planning-only here</h2>
        </div>
        <article className="info-card">
          <p>{policyMessage}</p>
        </article>
        <div className="info-card-grid">
          <article className="info-card">
            <h3>Daily BYOK policy</h3>
            <p>
              Free BYOK users may later get{" "}
              <strong>{policy?.freeByokDailyCreditsLater ?? 2500} daily Free AI Mixer platform credits.</strong>
            </p>
            <p>Multiple API keys do not multiply daily platform credits.</p>
          </article>
          <article className="info-card">
            <h3>Provider cost separation</h3>
            <p>User pays provider generation cost through their own API keys in BYOK mode.</p>
            <p>Free AI Mixer platform credits meter platform usage, not vendor generation cost.</p>
          </article>
          <article className="info-card">
            <h3>Shared wallet model</h3>
            <p>One global platform wallet will later cover mixer, templates, exports, and downloads.</p>
            <p>Multiple providers only increase routing and fallback options.</p>
          </article>
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Reservation lifecycle</p>
          <h2>Truthful usage accounting comes before real deduction</h2>
        </div>
        <div className="note-grid">
          {reservedLifecycleNotes.map((note) => (
            <article key={note} className="info-card">
              <p>{note}</p>
            </article>
          ))}
          <article className="info-card">
            <p>Credits and billing are not enabled yet.</p>
          </article>
          <article className="info-card">
            <p>
              Platform-paid generation must block with{" "}
              <strong>platform_credits_not_configured</strong> until wallet,
              ledger, usage-limit, and reservation readiness are real.
            </p>
          </article>
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Draft estimates</p>
          <h2>Planning-only credit ranges</h2>
        </div>
        <article className="info-card" data-testid="credits-draft-estimates-card">
          <p>Prices and credit estimates are draft planning only, not final business commitments.</p>
        </article>
        <div className="placeholder-grid">
          {policy?.draftEstimates.map((estimate) => (
            <article key={estimate.id} className="info-card">
              <h3>{estimate.label}</h3>
              <p>{estimate.creditRangeLabel}</p>
            </article>
          )) ?? null}
        </div>
      </div>
    </section>
  );
}
