import { useEffect } from "react";
import { useAiToolsStore } from "../store/aiToolsStore";
import { useNavigationStore } from "../store/navigationStore";

export function AiToolComparePage() {
  const comparisonsStatus = useAiToolsStore((state) => state.comparisonsStatus);
  const comparisonsMessage = useAiToolsStore((state) => state.comparisonsMessage);
  const visibleComparisons = useAiToolsStore((state) => state.visibleComparisons);
  const selectedCategory = useAiToolsStore((state) => state.selectedComparisonCategory);
  const searchQuery = useAiToolsStore((state) => state.comparisonSearchQuery);
  const pendingAction = useAiToolsStore((state) => state.pendingAction);
  const refreshComparisons = useAiToolsStore((state) => state.refreshComparisons);
  const setSelectedCategory = useAiToolsStore((state) => state.setSelectedComparisonCategory);
  const setSearchQuery = useAiToolsStore((state) => state.setComparisonSearchQuery);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  useEffect(() => {
    void refreshComparisons();
  }, [refreshComparisons]);

  return (
    <section className="ai-tool-compare-page" data-testid="ai-tool-compare-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 11</p>
          <h1>AI tools comparison shell</h1>
          <p className="placeholder-description">
            Comparison pages are editorial summaries only. They do not assign fake
            ratings, fake reviews, benchmark scores, or universal “best” claims.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              onClick={() => {
                void refreshComparisons();
              }}
              disabled={pendingAction === "comparisons"}
            >
              {pendingAction === "comparisons" ? "Refreshing..." : "Refresh comparisons"}
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

        <div className="status-callout" data-testid="comparison-status-card">
          <span className="status-kicker">Comparison state</span>
          <strong>{comparisonsStatus}</strong>
          <p>{comparisonsMessage}</p>
          <p>Readers should verify current provider details with official sources.</p>
        </div>
      </div>

      <div className="page-section">
        <div className="template-filter-grid">
          <label className="field">
            <span>Search comparisons</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by title, tools compared, or summary"
            />
          </label>
          <label className="field">
            <span>Comparison category</span>
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              <option value="all">All categories</option>
              <option value="creative_workflows">Creative workflows</option>
              <option value="visual_generation">Visual generation</option>
            </select>
          </label>
        </div>
      </div>

      <div className="page-section">
        <div className="template-gallery-grid" data-testid="comparison-catalog-grid">
          {visibleComparisons.map((comparison) => (
            <article
              key={comparison.comparisonId}
              className="provider-card"
              data-testid={`comparison-card-${comparison.comparisonId}`}
            >
              <p className="info-card-label">{comparison.comparisonCategory}</p>
              <h3>{comparison.title}</h3>
              <p>{comparison.summary}</p>
              <p><strong>Tools compared:</strong> {comparison.toolsCompared.join(", ")}</p>
              <p><strong>Last reviewed:</strong> {comparison.lastReviewedAt}</p>
              <p>No fake ratings, reviews, or usage counts are included.</p>
              <div className="hero-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => navigateTo(`/compare/${comparison.slug}`)}
                >
                  Review comparison detail
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
