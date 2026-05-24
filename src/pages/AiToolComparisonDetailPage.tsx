import { useEffect } from "react";
import { SeoMetadata } from "../components/SeoMetadata";
import {
  buildAiToolComparisonSeoMetadata,
  getComparisonSlugFromPath,
} from "../services/aiToolsService";
import { useAiToolsStore } from "../store/aiToolsStore";
import { useNavigationStore } from "../store/navigationStore";

export function AiToolComparisonDetailPage() {
  const currentPath = useNavigationStore((state) => state.currentPath);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const detailStatus = useAiToolsStore((state) => state.comparisonDetailStatus);
  const detailMessage = useAiToolsStore((state) => state.comparisonDetailMessage);
  const selectedComparison = useAiToolsStore((state) => state.selectedComparison);
  const loadComparisonDetailBySlug = useAiToolsStore((state) => state.loadComparisonDetailBySlug);

  const slug = getComparisonSlugFromPath(currentPath);

  useEffect(() => {
    if (slug) {
      void loadComparisonDetailBySlug(slug);
    }
  }, [loadComparisonDetailBySlug, slug]);

  const seoMetadata =
    selectedComparison && detailStatus === "ready"
      ? buildAiToolComparisonSeoMetadata(selectedComparison)
      : undefined;

  return (
    <section className="ai-tool-comparison-detail-page" data-testid="ai-tool-comparison-detail-page">
      {seoMetadata ? <SeoMetadata metadata={seoMetadata} /> : null}
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 11</p>
          <h1>AI tools comparison detail</h1>
          <p className="placeholder-description">
            This page is an editorial comparison only. It does not declare a
            universal winner or replace direct provider verification.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => navigateTo("/compare")}>
              Back to comparisons
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigateTo("/ai-tools")}
            >
              Browse AI tools
            </button>
          </div>
        </div>

        <div className="status-callout" data-testid="comparison-detail-status-card">
          <span className="status-kicker">Comparison detail</span>
          <strong>{detailStatus}</strong>
          <p>{detailMessage}</p>
          <p>No fake benchmark score, no fake rating, and no fake review data appear here.</p>
        </div>
      </div>

      <div className="page-section">
        <article className="info-card" data-testid="comparison-detail-card">
          {selectedComparison ? (
            <div className="template-detail-stack">
              <h2>{selectedComparison.title}</h2>
              <p>{selectedComparison.summary}</p>
              <p><strong>Tools compared:</strong> {selectedComparison.toolsCompared.join(", ")}</p>
              <p><strong>Last reviewed:</strong> {selectedComparison.lastReviewedAt}</p>
              <p><strong>Disclaimer:</strong> {selectedComparison.disclaimer}</p>
              <p>Verify with official provider sources before relying on current pricing or capability details.</p>
              <div className="placeholder-grid">
                {selectedComparison.capabilityRows.map((row) => (
                  <article key={row.label} className="info-card">
                    <h3>{row.label}</h3>
                    <ul className="editorial-list">
                      {Object.entries(row.values).map(([toolName, value]) => (
                        <li key={`${row.label}-${toolName}`}>
                          <strong>{toolName}:</strong> {value}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}
