import { useEffect } from "react";
import { useBillingStore } from "../store/billingStore";
import { useNavigationStore } from "../store/navigationStore";

export function PricingPage() {
  const status = useBillingStore((state) => state.status);
  const message = useBillingStore((state) => state.message);
  const plans = useBillingStore((state) => state.plans);
  const draftEstimates = useBillingStore((state) => state.draftEstimates);
  const providerBoundary = useBillingStore((state) => state.providerBoundary);
  const checkoutBoundary = useBillingStore((state) => state.checkoutBoundary);
  const webhookBoundary = useBillingStore((state) => state.webhookBoundary);
  const pendingAction = useBillingStore((state) => state.pendingAction);
  const refreshBilling = useBillingStore((state) => state.refreshBilling);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  useEffect(() => {
    void refreshBilling();
  }, [refreshBilling]);

  return (
    <section className="pricing-page" data-testid="pricing-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 8</p>
          <h1>Pricing is not enabled yet</h1>
          <p className="placeholder-description">
            This page only shows planned pricing and billing-policy boundaries. It
            does not offer checkout, subscriptions, purchases, or unlimited usage
            claims.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              onClick={() => {
                void refreshBilling();
              }}
              disabled={pendingAction === "refresh"}
            >
              {pendingAction === "refresh" ? "Refreshing..." : "Refresh pricing policy"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigateTo("/credits")}
            >
              Review credits policy
            </button>
          </div>
        </div>

        <div className="status-callout" data-testid="pricing-status-card">
          <span className="status-kicker">Pricing status</span>
          <strong>{status}</strong>
          <p>{message}</p>
          <p>Credits and billing are not enabled yet.</p>
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Draft plan direction</p>
          <h2>BYOK and platform billing stay separate</h2>
        </div>
        <div className="info-card-grid">
          {plans.map((plan) => (
            <article key={plan.planId} className="info-card">
              <h3>{plan.title}</h3>
              <p>{plan.summary}</p>
              <p>Draft only. No checkout or entitlement activation is available in this phase.</p>
            </article>
          ))}
          {plans.length === 0 ? (
            <article className="info-card">
              <h3>Draft plan copy only</h3>
              <p>BYOK users still pay provider generation cost through their own API keys.</p>
              <p>No fake plan selection, fake purchase success, or fake subscription state is shown here.</p>
            </article>
          ) : null}
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Billing boundaries</p>
          <h2>Processor and webhook integration stay fail-closed</h2>
        </div>
        <div className="placeholder-grid">
          <article className="info-card">
            <h3>Provider boundary</h3>
            <p>{providerBoundary?.message ?? "Billing provider wiring is not enabled yet."}</p>
          </article>
          <article className="info-card">
            <h3>Checkout boundary</h3>
            <p>{checkoutBoundary?.message ?? "Checkout is not enabled yet."}</p>
          </article>
          <article className="info-card">
            <h3>Webhook boundary</h3>
            <p>{webhookBoundary?.message ?? "Webhook processing is not live."}</p>
          </article>
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Draft estimates</p>
          <h2>Planning-only cost guidance</h2>
        </div>
        <article className="info-card" data-testid="pricing-draft-estimates-card">
          <p>Prices and credit estimates are draft planning only, not final business commitments.</p>
        </article>
        <div className="placeholder-grid">
          {draftEstimates.map((estimate) => (
            <article key={estimate.id} className="info-card">
              <h3>{estimate.label}</h3>
              <p>{estimate.creditRangeLabel}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
