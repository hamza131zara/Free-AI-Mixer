import { useEffect } from "react";
import { getCardCategoryFromPath } from "../services/cardCatalogService";
import { cardCategoryLabels } from "../types/cards";
import { useCardCatalogStore } from "../store/cardCatalogStore";
import { useNavigationStore } from "../store/navigationStore";

export function CardCategoryPage() {
  const currentPath = useNavigationStore((state) => state.currentPath);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const visibleTemplates = useCardCatalogStore((state) => state.visibleTemplates);
  const catalogStatus = useCardCatalogStore((state) => state.catalogStatus);
  const catalogMessage = useCardCatalogStore((state) => state.catalogMessage);
  const refreshCatalog = useCardCatalogStore((state) => state.refreshCatalog);
  const setSelectedCategory = useCardCatalogStore((state) => state.setSelectedCategory);
  const category = getCardCategoryFromPath(currentPath);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    if (category) {
      setSelectedCategory(category);
    }
  }, [category, setSelectedCategory]);

  const categoryLabel = category ? cardCategoryLabels[category] : "Cards";

  return (
    <section className="card-category-page" data-testid="card-category-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 12</p>
          <h1>{categoryLabel} card templates</h1>
          <p className="placeholder-description">
            This category page shows static card templates only. The preview flow is
            local, and download, share, QR, AI generation, and saving are not enabled.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => navigateTo("/cards")}>
              Back to cards gallery
            </button>
          </div>
        </div>

        <div className="status-callout" data-testid="card-category-status-card">
          <span className="status-kicker">Category state</span>
          <strong>{catalogStatus}</strong>
          <p>{catalogMessage}</p>
          <p>Static sample templates only. No fake generated output or deceptive financial designs.</p>
        </div>
      </div>

      <div className="template-gallery-grid" data-testid="card-category-grid">
        {visibleTemplates.map((template) => (
          <article
            key={template.cardTemplateId}
            className="provider-card"
            data-testid={`card-category-template-${template.cardTemplateId}`}
          >
            <p className="info-card-label">{template.occasion}</p>
            <h3>{template.title}</h3>
            <p>{template.description}</p>
            <p><strong>Ownership note:</strong> {template.sourceOwnershipNotes}</p>
            <div className="hero-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => navigateTo(`/cards/template/${template.slug}`)}
              >
                Open local preview shell
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
