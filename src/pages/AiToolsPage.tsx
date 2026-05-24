import { useEffect } from "react";
import { useAiToolsStore } from "../store/aiToolsStore";
import { useNavigationStore } from "../store/navigationStore";

export function AiToolsPage() {
  const catalogStatus = useAiToolsStore((state) => state.catalogStatus);
  const catalogMessage = useAiToolsStore((state) => state.catalogMessage);
  const visibleTools = useAiToolsStore((state) => state.visibleTools);
  const selectedCategory = useAiToolsStore((state) => state.selectedCategory);
  const searchQuery = useAiToolsStore((state) => state.searchQuery);
  const pendingAction = useAiToolsStore((state) => state.pendingAction);
  const refreshCatalog = useAiToolsStore((state) => state.refreshCatalog);
  const setSelectedCategory = useAiToolsStore((state) => state.setSelectedCategory);
  const setSearchQuery = useAiToolsStore((state) => state.setSearchQuery);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const categoryOptions = [
    "all",
    "assistant",
    "writing",
    "multimodal",
    "video_generation",
    "editing",
    "creative_suite",
    "image_generation",
    "creative_tool",
  ] as const;

  return (
    <section className="ai-tools-page" data-testid="ai-tools-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 11</p>
          <h1>AI tools directory shell</h1>
          <p className="placeholder-description">
            This public catalog is editorial and source-linked only. It does not rank
            tools, trigger providers, or imply Free AI Mixer already integrates with
            every tool listed here.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              onClick={() => {
                void refreshCatalog();
              }}
              disabled={pendingAction === "catalog"}
            >
              {pendingAction === "catalog" ? "Refreshing..." : "Refresh tools catalog"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigateTo("/compare")}
            >
              Review comparisons
            </button>
          </div>
        </div>

        <div className="status-callout" data-testid="ai-tools-status-card">
          <span className="status-kicker">Editorial status</span>
          <strong>{catalogStatus}</strong>
          <p>{catalogMessage}</p>
          <p>No fake rankings, ratings, popularity metrics, or live provider execution are shown here.</p>
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Search and filter shell</p>
          <h2>Editorial catalog browsing</h2>
        </div>
        <div className="template-filter-grid">
          <label className="field">
            <span>Search tools</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, provider, capability, or category"
            />
          </label>
          <label className="field">
            <span>Category</span>
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All categories" : option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">AI tools</p>
          <h2>Source-linked editorial entries</h2>
        </div>
        <div className="template-gallery-grid" data-testid="ai-tools-catalog-grid">
          {visibleTools.map((tool) => (
            <article
              key={tool.toolId}
              className="provider-card"
              data-testid={`ai-tool-card-${tool.toolId}`}
            >
              <p className="info-card-label">{tool.companyOrProvider}</p>
              <h3>{tool.name}</h3>
              <p>{tool.shortDescription}</p>
              <p><strong>Categories:</strong> {tool.categories.join(", ")}</p>
              <p><strong>Pricing:</strong> {tool.pricingStatus}</p>
              <p><strong>Integration:</strong> {tool.freeAiMixerIntegrationStatus}</p>
              <p>Unknown fields remain unknown until reviewed against official sources.</p>
              <div className="hero-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => navigateTo(`/ai-tools/${tool.slug}`)}
                >
                  Review tool detail
                </button>
              </div>
            </article>
          ))}
          {visibleTools.length === 0 ? (
            <article className="info-card">
              <h3>No tools match this search yet</h3>
              <p>No fake tool cards are added to fill the catalog when filters return empty results.</p>
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}
