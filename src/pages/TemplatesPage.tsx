import { useEffect } from "react";
import { useNavigationStore } from "../store/navigationStore";
import { useTemplateCatalogStore } from "../store/templateCatalogStore";
import type { TemplateCategory } from "../types/templates";

const categoryLabels: Array<{ value: "all" | TemplateCategory; label: string }> = [
  { value: "all", label: "All categories" },
  { value: "social_video", label: "Social video" },
  { value: "product_story", label: "Product story" },
  { value: "ugc", label: "UGC" },
  { value: "photo_motion", label: "Photo motion" },
  { value: "brand_intro", label: "Brand intro" },
];

export function TemplatesPage() {
  const catalogStatus = useTemplateCatalogStore((state) => state.catalogStatus);
  const catalogMessage = useTemplateCatalogStore((state) => state.catalogMessage);
  const visibleTemplates = useTemplateCatalogStore((state) => state.visibleTemplates);
  const selectedCategory = useTemplateCatalogStore((state) => state.selectedCategory);
  const searchQuery = useTemplateCatalogStore((state) => state.searchQuery);
  const selectedTemplateId = useTemplateCatalogStore((state) => state.selectedTemplateId);
  const detailStatus = useTemplateCatalogStore((state) => state.detailStatus);
  const detailMessage = useTemplateCatalogStore((state) => state.detailMessage);
  const selectedTemplate = useTemplateCatalogStore((state) => state.selectedTemplate);
  const pendingAction = useTemplateCatalogStore((state) => state.pendingAction);
  const refreshCatalog = useTemplateCatalogStore((state) => state.refreshCatalog);
  const setSelectedCategory = useTemplateCatalogStore((state) => state.setSelectedCategory);
  const setSearchQuery = useTemplateCatalogStore((state) => state.setSearchQuery);
  const selectTemplate = useTemplateCatalogStore((state) => state.selectTemplate);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  return (
    <section className="templates-page" data-testid="templates-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 9</p>
          <h1>Templates gallery shell</h1>
          <p className="placeholder-description">
            This gallery only shows static template metadata and planning details.
            It does not generate output, spend credits, create projects, or offer
            downloads in this phase.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              onClick={() => {
                void refreshCatalog();
              }}
              disabled={pendingAction === "refresh"}
            >
              {pendingAction === "refresh" ? "Refreshing..." : "Refresh template catalog"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigateTo("/onboarding")}
            >
              Review onboarding
            </button>
          </div>
        </div>

        <div className="status-callout" data-testid="templates-status-card">
          <span className="status-kicker">Gallery status</span>
          <strong>{catalogStatus}</strong>
          <p>{catalogMessage}</p>
          <p>Static sample content only. Generation is not enabled yet.</p>
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Gallery filters</p>
          <h2>Search and category shell</h2>
        </div>
        <div className="template-filter-grid">
          <label className="field">
            <span>Search templates</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by title, use case, or category"
            />
          </label>
          <label className="field">
            <span>Category</span>
            <select
              value={selectedCategory}
              onChange={(event) =>
                setSelectedCategory(event.target.value as "all" | TemplateCategory)}
            >
              {categoryLabels.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Template gallery</p>
          <h2>Static planning metadata only</h2>
        </div>
        <div className="template-gallery-grid" data-testid="template-gallery-grid">
          {visibleTemplates.map((template) => (
            <article
              key={template.templateId}
              className="provider-card"
              data-testid={`template-card-${template.templateId}`}
            >
              <p className="info-card-label">{template.category}</p>
              <h3>{template.title}</h3>
              <p>{template.description}</p>
              <p><strong>Status:</strong> {template.status}</p>
              <p><strong>Sample label:</strong> {template.sampleLabel}</p>
              <p><strong>Draft estimate:</strong> {template.draftCreditEstimate.label}</p>
              <p>Draft planning only. Not a final price or live credit deduction.</p>
              <div className="hero-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    void selectTemplate(template.templateId);
                  }}
                  disabled={pendingAction === "detail" && selectedTemplateId === template.templateId}
                >
                  {pendingAction === "detail" && selectedTemplateId === template.templateId
                    ? "Loading detail..."
                    : "Review template detail"}
                </button>
              </div>
            </article>
          ))}
          {visibleTemplates.length === 0 ? (
            <article className="info-card">
              <h3>No templates match this shell filter yet</h3>
              <p>Try a different search or category. No fake template cards are added to fill empty space.</p>
            </article>
          ) : null}
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Template detail</p>
          <h2>Planning-only detail shell</h2>
        </div>
        <article className="info-card" data-testid="template-detail-panel">
          <p>{detailMessage}</p>
          {selectedTemplate ? (
            <div className="template-detail-stack">
              <h3>{selectedTemplate.title}</h3>
              <p>{selectedTemplate.useCase}</p>
              <p><strong>Output type:</strong> {selectedTemplate.outputType}</p>
              <p><strong>Provider capabilities:</strong> {selectedTemplate.providerCapabilityRequirements.join(", ")}</p>
              <p><strong>Draft estimate:</strong> {selectedTemplate.draftCreditEstimate.label}</p>
              <p>Draft planning only. Generation, downloads, and project saving are not enabled yet.</p>
              <div className="placeholder-grid">
                {selectedTemplate.requiredInputs.map((input) => (
                  <article key={input.fieldId} className="info-card">
                    <h3>{input.label}</h3>
                    <p>{input.description}</p>
                    <p><strong>Field kind:</strong> {input.kind}</p>
                    <p><strong>Planning state:</strong> Input shown for planning only, not live execution.</p>
                  </article>
                ))}
              </div>
              <div className="note-grid">
                {selectedTemplate.safetyLabels.map((label) => (
                  <article key={label} className="info-card">
                    <p>{label}</p>
                  </article>
                ))}
              </div>
              <div className="hero-actions">
                <button type="button" disabled>
                  Generation not enabled yet
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => navigateTo("/mixer")}
                >
                  Open Mixer
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => navigateTo("/settings/providers")}
                >
                  Review Provider Settings
                </button>
              </div>
            </div>
          ) : null}
          {detailStatus === "idle" ? (
            <p>Select a template to review required inputs, draft estimates, and safety notes.</p>
          ) : null}
        </article>
      </div>
    </section>
  );
}
