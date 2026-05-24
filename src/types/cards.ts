import type { RouteSeoMetadata } from "./seo";

export type CardCategory =
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

export type CardTemplateStatus =
  | "draft"
  | "published"
  | "needs_review"
  | "unavailable";

export type CardLayout = "portrait" | "landscape" | "square";

export type CardOutputAspectRatio = "4:5" | "16:9" | "1:1" | "3:2";

export type CardSamplePreviewKind = "static_sample_only";

export type CardFieldKind =
  | "text"
  | "multiline"
  | "date"
  | "time"
  | "email"
  | "phone"
  | "url"
  | "theme_option"
  | "font_option";

export interface CardTemplateFieldOption {
  value: string;
  label: string;
}

export interface CardTemplateField {
  fieldId: string;
  label: string;
  kind: CardFieldKind;
  placeholder?: string;
  required: boolean;
  helpText: string;
  options?: CardTemplateFieldOption[];
}

export interface CardThemeTokens {
  background: string;
  foreground: string;
  accent: string;
  border: string;
}

export interface CardDraftCreditEstimate {
  label: string;
  planningOnly: true;
}

export interface CardTemplateCatalogEntry {
  cardTemplateId: string;
  slug: string;
  title: string;
  category: CardCategory;
  occasion: string;
  description: string;
  supportedFields: CardTemplateField[];
  layout: CardLayout;
  themeTokens: CardThemeTokens;
  outputAspectRatio: CardOutputAspectRatio;
  safeUseLabel: string;
  samplePreviewKind: CardSamplePreviewKind;
  draftCreditEstimate?: CardDraftCreditEstimate;
  status: CardTemplateStatus;
  lastReviewedAt: string;
  sourceOwnershipNotes: string;
  disclaimer: string;
}

export type CardTemplateDetail = CardTemplateCatalogEntry;

export interface CardsCatalogResult {
  kind: "catalog";
  message: string;
  templates: CardTemplateCatalogEntry[];
}

export type CardTemplateDetailResult =
  | {
      kind: "detail";
      message: string;
      template: CardTemplateDetail;
    }
  | {
      kind: "not_found";
      message: string;
    }
  | {
      kind: "unavailable";
      message: string;
    };

export interface CardPreviewState {
  templateId: string;
  fieldValues: Record<string, string>;
}

export const cardCategoryLabels: Record<CardCategory, string> = {
  birthday: "Birthday",
  wedding: "Wedding",
  invitation: "Invitations",
  eid: "Eid",
  christmas: "Christmas",
  holi: "Holi",
  halloween: "Halloween",
  business: "Business",
  visiting: "Visiting",
  gift: "Gift",
};

export const buildCardDetailSeoMetadata = (
  template: CardTemplateDetail,
): RouteSeoMetadata => ({
  title: `${template.title} | Card Generator | Free AI Mixer`,
  description: `${template.description} Static template MVP with local preview only and no download or share features enabled.`,
  canonicalPath: `/cards/template/${template.slug}`,
  indexable: true,
  includeInSitemap: false,
  robots: "index,follow",
});
