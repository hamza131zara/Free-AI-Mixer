import { useEffect } from "react";
import { useAiNewsStore } from "../store/aiNewsStore";
import { useNavigationStore } from "../store/navigationStore";

export function AiNewsPage() {
  const feedStatus = useAiNewsStore((state) => state.feedStatus);
  const feedMessage = useAiNewsStore((state) => state.feedMessage);
  const visibleItems = useAiNewsStore((state) => state.visibleItems);
  const selectedCategory = useAiNewsStore((state) => state.selectedCategory);
  const searchQuery = useAiNewsStore((state) => state.searchQuery);
  const pendingAction = useAiNewsStore((state) => state.pendingAction);
  const refreshFeed = useAiNewsStore((state) => state.refreshFeed);
  const setSelectedCategory = useAiNewsStore((state) => state.setSelectedCategory);
  const setSearchQuery = useAiNewsStore((state) => state.setSearchQuery);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  useEffect(() => {
    void refreshFeed();
  }, [refreshFeed]);

  return (
    <section className="ai-news-page" data-testid="ai-news-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 11</p>
          <h1>AI news editorial shell</h1>
          <p className="placeholder-description">
            This is a manual editorial feed shell. It does not auto-scrape sources,
            fetch live updates at request time, or claim “latest” unless entries are
            explicitly reviewed.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              onClick={() => {
                void refreshFeed();
              }}
              disabled={pendingAction === "feed"}
            >
              {pendingAction === "feed" ? "Refreshing..." : "Refresh news shell"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigateTo("/help")}
            >
              Review help
            </button>
          </div>
        </div>

        <div className="status-callout" data-testid="ai-news-status-card">
          <span className="status-kicker">Feed status</span>
          <strong>{feedStatus}</strong>
          <p>{feedMessage}</p>
          <p>No fake latest claim, no live ingestion, and no copied article text are used here.</p>
        </div>
      </div>

      <div className="page-section">
        <div className="template-filter-grid">
          <label className="field">
            <span>Search news items</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by title, category, or source"
            />
          </label>
          <label className="field">
            <span>Category</span>
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              <option value="all">All categories</option>
              <option value="product_update">Product update</option>
              <option value="roundup">Roundup</option>
            </select>
          </label>
        </div>
      </div>

      <div className="page-section">
        <div className="template-gallery-grid" data-testid="ai-news-feed-grid">
          {visibleItems.map((item) => (
            <article
              key={item.feedItemId}
              className="provider-card"
              data-testid={`ai-news-card-${item.feedItemId}`}
            >
              <p className="info-card-label">{item.sourceName}</p>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <p><strong>Published:</strong> {item.publishedAt}</p>
              <p><strong>Last checked:</strong> {item.lastCheckedAt}</p>
              <div className="hero-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => navigateTo(`/ai-news/${item.slug}`)}
                >
                  Review editorial note
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
