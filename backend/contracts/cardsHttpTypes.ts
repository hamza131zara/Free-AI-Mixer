export type BackendCardCategory =
  | "birthday"
  | "wedding"
  | "invitation"
  | "eid"
  | "christmas"
  | "holi"
  | "halloween"
  | "business"
  | "visiting"
  | "gift";

export type BackendCardTemplateStatus =
  | "draft"
  | "published"
  | "needs_review"
  | "unavailable";

export type BackendCardLayout = "portrait" | "landscape" | "square";

export type BackendCardOutputAspectRatio = "4:5" | "16:9" | "1:1" | "3:2";

export type BackendCardSamplePreviewKind = "static_sample_only";

export type BackendCardFieldKind =
  | "text"
  | "multiline"
  | "date"
  | "time"
  | "email"
  | "phone"
  | "url"
  | "theme_option"
  | "font_option";

export interface BackendCardTemplateFieldOption {
  value: string;
  label: string;
}

export interface BackendCardTemplateField {
  fieldId: string;
  label: string;
  kind: BackendCardFieldKind;
  placeholder?: string;
  required: boolean;
  helpText: string;
  options?: BackendCardTemplateFieldOption[];
}

export interface BackendCardThemeTokens {
  background: string;
  foreground: string;
  accent: string;
  border: string;
}

export interface BackendCardDraftCreditEstimate {
  label: string;
  planningOnly: true;
}

export interface BackendCardTemplateCatalogEntry {
  cardTemplateId: string;
  slug: string;
  title: string;
  category: BackendCardCategory;
  occasion: string;
  description: string;
  supportedFields: BackendCardTemplateField[];
  layout: BackendCardLayout;
  themeTokens: BackendCardThemeTokens;
  outputAspectRatio: BackendCardOutputAspectRatio;
  safeUseLabel: string;
  samplePreviewKind: BackendCardSamplePreviewKind;
  draftCreditEstimate?: BackendCardDraftCreditEstimate;
  status: BackendCardTemplateStatus;
  lastReviewedAt: string;
  sourceOwnershipNotes: string;
  disclaimer: string;
}

export type BackendCardTemplateDetail = BackendCardTemplateCatalogEntry;

export interface BackendCardsCatalogResponse {
  kind: "cards_catalog";
  message: string;
  templates: BackendCardTemplateCatalogEntry[];
}

export type BackendCardTemplateDetailResponse =
  | {
      kind: "card_template_detail";
      message: string;
      template: BackendCardTemplateDetail;
    }
  | {
      kind: "card_template_not_found";
      message: string;
    };
