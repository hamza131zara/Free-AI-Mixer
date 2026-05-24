import { useEffect } from "react";
import type { CardCategory } from "../types/cards";
import { cardCategoryLabels } from "../types/cards";
import { useCardCatalogStore } from "../store/cardCatalogStore";
import { useNavigationStore } from "../store/navigationStore";

const cardCategoryOptions: CardCategory[] = [
  "birthday",
  "wedding",
  "invitation",
  "eid",
  "christmas",
  "holi",
  "halloween",
  "business",
  "visiting",
  "gift",
];

export function CardsPage() {
  const catalogStatus = useCardCatalogStore((state) => state.catalogStatus);
  const catalogMessage = useCardCatalogStore((state) => state.catalogMessage);
  const visibleTemplates = useCardCatalogStore((state) => state.visibleTemplates);
  const selectedCategory = useCardCatalogStore((state) => state.selectedCategory);
  const searchQuery = useCardCatalogStore((state) => state.searchQuery);
  const pendingAction = useCardCatalogStore((state) => state.pendingAction);
  const refreshCatalog = useCardCatalogStore((state) => state.refreshCatalog);
  const setSelectedCategory = useCardCatalogStore((state) => state.setSelectedCategory);
  const setSearchQuery = useCardCatalogStore((state) => state.setSearchQuery);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  return (
    <section className="cards-page" data-testid="cards-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 12</p>
          <h1>Card Generator static template MVP</h1>
          <p className="placeholder-description">
            This module provides static card templates with local editable fields and
            a live local preview only. AI generation, downloads, sharing, QR codes,
            and project saving are not enabled yet.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              onClick={() => {
                void refreshCatalog();
              }}
              disabled={pendingAction === "catalog"}
            >
              {pendingAction === "catalog" ? "Refreshing..." : "Refresh card catalog"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigateTo("/templates")}
            >
              Review Templates
            </button>
          </div>
        </div>

        <div className="status-callout" data-testid="cards-status-card">
          <span className="status-kicker">MVP state</span>
          <strong>{catalogStatus}</strong>
          <p>{catalogMessage}</p>
          <p>Local preview only. Download, share, QR, AI generation, and project saving are disabled.</p>
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Category and search shell</p>
          <h2>Browse safe static templates</h2>
        </div>
        <div className="template-filter-grid">
          <label className="field">
            <span>Search cards</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by title, occasion, or category"
            />
          </label>
          <label className="field">
            <span>Category</span>
            <select
              value={selectedCategory}
              onChange={(event) =>
                setSelectedCategory(event.target.value as "all" | keyof typeof cardCategoryLabels)}
            >
              {(["all", ...cardCategoryOptions] as const).map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All categories" : cardCategoryLabels[option]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="page-section">
        <div className="route-card-grid" data-testid="cards-category-grid">
          {Object.entries(cardCategoryLabels).map(([category, label]) => (
            <article key={category} className="route-card">
              <p className="route-card-path">{`/cards/${category}`}</p>
              <h3>{label}</h3>
              <p>Static template category only. No fake AI generation, no fake downloads, and no fake share links.</p>
              <button
                type="button"
                className="secondary"
                onClick={() => navigateTo(`/cards/${category}`)}
              >
                Open {label}
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Template gallery</p>
          <h2>Decorative non-financial card templates</h2>
        </div>
        <div className="template-gallery-grid" data-testid="cards-gallery-grid">
          {visibleTemplates.map((template) => (
            <article
              key={template.cardTemplateId}
              className="provider-card"
              data-testid={`card-template-card-${template.cardTemplateId}`}
            >
              <p className="info-card-label">{cardCategoryLabels[template.category]}</p>
              <h3>{template.title}</h3>
              <p>{template.description}</p>
              <p><strong>Sample:</strong> {template.samplePreviewKind.replaceAll("_", " ")}</p>
              <p><strong>Status:</strong> {template.status}</p>
              <p><strong>Safe use:</strong> {template.safeUseLabel}</p>
              <p>No fake download, no fake share page, and no fake QR code are available.</p>
              <div className="hero-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => navigateTo(`/cards/template/${template.slug}`)}
                >
                  Open card editor shell
                </button>
              </div>
            </article>
          ))}
          {visibleTemplates.length === 0 ? (
            <article className="info-card">
              <h3>No card templates match this filter</h3>
              <p>No fake card entries are added to fill empty results.</p>
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}
