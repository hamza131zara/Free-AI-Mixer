import { useEffect } from "react";
import { SeoMetadata } from "../components/SeoMetadata";
import {
  getCardTemplateSlugFromPath,
} from "../services/cardCatalogService";
import {
  buildCardDetailSeoMetadata,
  cardCategoryLabels,
} from "../types/cards";
import { useCardCatalogStore } from "../store/cardCatalogStore";
import { useNavigationStore } from "../store/navigationStore";

export function CardTemplateEditorPage() {
  const currentPath = useNavigationStore((state) => state.currentPath);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const detailStatus = useCardCatalogStore((state) => state.detailStatus);
  const detailMessage = useCardCatalogStore((state) => state.detailMessage);
  const selectedTemplate = useCardCatalogStore((state) => state.selectedTemplate);
  const previewState = useCardCatalogStore((state) => state.previewState);
  const loadTemplateBySlug = useCardCatalogStore((state) => state.loadTemplateBySlug);
  const updatePreviewField = useCardCatalogStore((state) => state.updatePreviewField);

  const slug = getCardTemplateSlugFromPath(currentPath);

  useEffect(() => {
    if (slug) {
      void loadTemplateBySlug(slug);
    }
  }, [loadTemplateBySlug, slug]);

  const seoMetadata =
    selectedTemplate && detailStatus === "ready"
      ? buildCardDetailSeoMetadata(selectedTemplate)
      : undefined;

  const previewValues = previewState?.fieldValues ?? {};
  const eventTitle =
    previewValues.event_title ||
    previewValues.business_name ||
    selectedTemplate?.title ||
    "Card title";
  const primaryName =
    previewValues.recipient_name ||
    previewValues.sender_name ||
    "Preview name";
  const supportText =
    previewValues.short_message ||
    previewValues.venue_address ||
    previewValues.website ||
    "Local preview only. Download, share, and QR are not enabled yet.";

  return (
    <section className="card-template-editor-page" data-testid="card-template-editor-page">
      {seoMetadata ? <SeoMetadata metadata={seoMetadata} /> : null}
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 12</p>
          <h1>Card editor local preview shell</h1>
          <p className="placeholder-description">
            This page provides a local editable preview only. It does not save to
            projects, create hosted links, generate QR codes, or produce a real
            downloadable card file.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => navigateTo("/cards")}>
              Back to cards
            </button>
            {selectedTemplate ? (
              <button
                type="button"
                className="secondary"
                onClick={() => navigateTo(`/cards/${selectedTemplate.category}`)}
              >
                Back to {cardCategoryLabels[selectedTemplate.category]}
              </button>
            ) : null}
          </div>
        </div>

        <div className="status-callout" data-testid="card-editor-status-card">
          <span className="status-kicker">Editor state</span>
          <strong>{detailStatus}</strong>
          <p>{detailMessage}</p>
          <p>No fake download, no fake share page, no fake QR code, and no fake save-to-project exist here.</p>
        </div>
      </div>

      <div className="page-section card-editor-grid">
        <article className="info-card" data-testid="card-editor-fields">
          <h2>Editable fields</h2>
          <p>Local preview only. User-entered text renders safely as plain text in the card preview.</p>
          {selectedTemplate ? (
            <div className="template-detail-stack">
              {selectedTemplate.supportedFields.map((field) => (
                <label key={field.fieldId} className="field">
                  <span>{field.label}</span>
                  {field.kind === "multiline" ? (
                    <textarea
                      value={previewValues[field.fieldId] ?? ""}
                      onChange={(event) => updatePreviewField(field.fieldId, event.target.value)}
                      placeholder={field.placeholder}
                      rows={4}
                    />
                  ) : field.kind === "theme_option" || field.kind === "font_option" ? (
                    <select
                      value={previewValues[field.fieldId] ?? field.options?.[0]?.value ?? ""}
                      onChange={(event) => updatePreviewField(field.fieldId, event.target.value)}
                    >
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={
                        field.kind === "date"
                          ? "date"
                          : field.kind === "time"
                            ? "time"
                            : field.kind === "email"
                              ? "email"
                              : field.kind === "phone"
                                ? "tel"
                                : field.kind === "url"
                                  ? "url"
                                  : "text"
                      }
                      value={previewValues[field.fieldId] ?? ""}
                      onChange={(event) => updatePreviewField(field.fieldId, event.target.value)}
                      placeholder={field.placeholder}
                    />
                  )}
                  <small>{field.helpText}</small>
                </label>
              ))}
            </div>
          ) : null}
        </article>

        <article className="info-card" data-testid="card-live-preview">
          <h2>Live local preview</h2>
          <p>Static card template MVP only. No AI generation, no export job, and no delivery URL are created.</p>
          {selectedTemplate ? (
            <div
              className={`card-preview-frame card-preview-${selectedTemplate.layout}`}
              style={{
                background: selectedTemplate.themeTokens.background,
                color: selectedTemplate.themeTokens.foreground,
                borderColor: selectedTemplate.themeTokens.border,
              }}
            >
              <p className="card-preview-kicker">{selectedTemplate.occasion}</p>
              <h3>{eventTitle}</h3>
              <p className="card-preview-name">{primaryName}</p>
              <p>{supportText}</p>
              <div className="card-preview-meta">
                <span>{selectedTemplate.safeUseLabel}</span>
                <span>{selectedTemplate.samplePreviewKind.replaceAll("_", " ")}</span>
              </div>
            </div>
          ) : null}
          <div className="hero-actions">
            <button type="button" disabled>
              Download coming later
            </button>
            <button type="button" className="secondary" disabled>
              Share and QR coming later
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
