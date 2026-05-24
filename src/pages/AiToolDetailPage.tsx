import { useEffect } from "react";
import { SeoMetadata } from "../components/SeoMetadata";
import {
  buildAiToolDetailSeoMetadata,
  getAiToolSlugFromPath,
} from "../services/aiToolsService";
import { useAiToolsStore } from "../store/aiToolsStore";
import { useNavigationStore } from "../store/navigationStore";

export function AiToolDetailPage() {
  const currentPath = useNavigationStore((state) => state.currentPath);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const detailStatus = useAiToolsStore((state) => state.detailStatus);
  const detailMessage = useAiToolsStore((state) => state.detailMessage);
  const selectedTool = useAiToolsStore((state) => state.selectedTool);
  const pendingAction = useAiToolsStore((state) => state.pendingAction);
  const loadToolDetailBySlug = useAiToolsStore((state) => state.loadToolDetailBySlug);

  const slug = getAiToolSlugFromPath(currentPath);

  useEffect(() => {
    if (slug) {
      void loadToolDetailBySlug(slug);
    }
  }, [loadToolDetailBySlug, slug]);

  const seoMetadata =
    selectedTool && detailStatus === "ready"
      ? buildAiToolDetailSeoMetadata(selectedTool)
      : undefined;

  return (
    <section className="ai-tool-detail-page" data-testid="ai-tool-detail-page">
      {seoMetadata ? <SeoMetadata metadata={seoMetadata} /> : null}
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 11</p>
          <h1>AI tool editorial detail</h1>
          <p className="placeholder-description">
            This page is an editorial summary only. It does not rank, review, or
            execute the tool, and it does not imply Free AI Mixer already connects to
            it.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => navigateTo("/ai-tools")}>
              Back to AI tools
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

        <div className="status-callout" data-testid="ai-tool-detail-status-card">
          <span className="status-kicker">Detail status</span>
          <strong>{detailStatus}</strong>
          <p>{detailMessage}</p>
          <p>No fake rating, no fake review count, and no fake integration readiness are shown here.</p>
        </div>
      </div>

      <div className="page-section">
        <article className="info-card" data-testid="ai-tool-detail-card">
          {selectedTool ? (
            <div className="template-detail-stack">
              <h2>{selectedTool.name}</h2>
              <p>{selectedTool.shortDescription}</p>
              <p><strong>Provider:</strong> {selectedTool.companyOrProvider}</p>
              <p><strong>Pricing status:</strong> {selectedTool.pricingStatus}</p>
              <p><strong>API availability:</strong> {selectedTool.apiAvailability}</p>
              <p><strong>BYOK support:</strong> {selectedTool.byokSupportStatus}</p>
              <p><strong>Free AI Mixer integration:</strong> {selectedTool.freeAiMixerIntegrationStatus}</p>
              <p><strong>Last reviewed:</strong> {selectedTool.lastReviewedAt}</p>
              <p><strong>Disclaimer:</strong> {selectedTool.disclaimer}</p>
              <p>Verify capabilities, pricing, and plan details with official provider sources.</p>
              <div className="placeholder-grid">
                <article className="info-card">
                  <h3>Best use cases</h3>
                  <ul className="editorial-list">
                    {selectedTool.bestUseCases.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article className="info-card">
                  <h3>Limitations</h3>
                  <ul className="editorial-list">
                    {selectedTool.limitations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              </div>
              <div className="hero-actions">
                <a href={selectedTool.officialWebsiteUrl} target="_blank" rel="noreferrer">
                  Official website
                </a>
                {selectedTool.pricingSourceUrl ? (
                  <a href={selectedTool.pricingSourceUrl} target="_blank" rel="noreferrer">
                    Pricing source
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
          {!selectedTool && pendingAction !== "detail" ? (
            <p>Select an AI tool from the directory to review source-linked editorial details.</p>
          ) : null}
        </article>
      </div>
    </section>
  );
}
