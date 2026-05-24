import { useEffect } from "react";
import { SeoMetadata } from "../components/SeoMetadata";
import {
  buildAiNewsDetailSeoMetadata,
  getAiNewsSlugFromPath,
} from "../services/aiNewsService";
import { useAiNewsStore } from "../store/aiNewsStore";
import { useNavigationStore } from "../store/navigationStore";

export function AiNewsDetailPage() {
  const currentPath = useNavigationStore((state) => state.currentPath);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const detailStatus = useAiNewsStore((state) => state.detailStatus);
  const detailMessage = useAiNewsStore((state) => state.detailMessage);
  const selectedItem = useAiNewsStore((state) => state.selectedItem);
  const loadDetailBySlug = useAiNewsStore((state) => state.loadDetailBySlug);

  const slug = getAiNewsSlugFromPath(currentPath);

  useEffect(() => {
    if (slug) {
      void loadDetailBySlug(slug);
    }
  }, [loadDetailBySlug, slug]);

  const seoMetadata =
    selectedItem && detailStatus === "ready"
      ? buildAiNewsDetailSeoMetadata(selectedItem)
      : undefined;

  return (
    <section className="ai-news-detail-page" data-testid="ai-news-detail-page">
      {seoMetadata ? <SeoMetadata metadata={seoMetadata} /> : null}
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 11</p>
          <h1>AI news editorial detail</h1>
          <p className="placeholder-description">
            This page is a short editorial summary only. Readers should verify the
            source directly before relying on time-sensitive details.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => navigateTo("/ai-news")}>
              Back to AI news
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

        <div className="status-callout" data-testid="ai-news-detail-status-card">
          <span className="status-kicker">Editorial detail</span>
          <strong>{detailStatus}</strong>
          <p>{detailMessage}</p>
          <p>No fake latest-feed claim and no copied full article text are shown here.</p>
        </div>
      </div>

      <div className="page-section">
        <article className="info-card" data-testid="ai-news-detail-card">
          {selectedItem ? (
            <div className="template-detail-stack">
              <h2>{selectedItem.title}</h2>
              <p>{selectedItem.summary}</p>
              <p><strong>Source:</strong> {selectedItem.sourceName}</p>
              <p><strong>Published:</strong> {selectedItem.publishedAt}</p>
              <p><strong>Last checked:</strong> {selectedItem.lastCheckedAt}</p>
              <p><strong>Editorial note:</strong> {selectedItem.editorialNote}</p>
              <div className="hero-actions">
                <a href={selectedItem.sourceUrl} target="_blank" rel="noreferrer">
                  Open source
                </a>
              </div>
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}
