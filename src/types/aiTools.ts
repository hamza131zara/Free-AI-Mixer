import type { RouteSeoMetadata } from "./seo";

export type AiToolPricingStatus =
  | "unknown"
  | "free"
  | "paid"
  | "freemium"
  | "contact_sales";

export type AiToolApiAvailability =
  | "unknown"
  | "public_api"
  | "limited_api"
  | "no_public_api";

export type AiToolByokSupportStatus =
  | "unknown"
  | "supported"
  | "limited"
  | "not_supported";

export type AiToolIntegrationStatus =
  | "planned"
  | "available"
  | "not_supported"
  | "unknown";

export type AiToolEditorialStatus = "draft" | "published" | "needs_review";

export interface AiToolCatalogEntry {
  toolId: string;
  slug: string;
  name: string;
  companyOrProvider: string;
  officialWebsiteUrl: string;
  shortDescription: string;
  categories: string[];
  capabilities: string[];
  supportedInputTypes: string[];
  supportedOutputTypes: string[];
  apiAvailability: AiToolApiAvailability;
  byokSupportStatus: AiToolByokSupportStatus;
  pricingStatus: AiToolPricingStatus;
  pricingSourceUrl?: string;
  freeAiMixerIntegrationStatus: AiToolIntegrationStatus;
  sourceUrls: string[];
  lastReviewedAt: string;
  lastUpdatedAt: string;
  editorialStatus: AiToolEditorialStatus;
  disclaimer: string;
}

export interface AiToolDetail extends AiToolCatalogEntry {
  limitations: string[];
  bestUseCases: string[];
}

export interface AiToolComparisonCapabilityRow {
  label: string;
  values: Record<string, string>;
}

export interface AiToolComparisonCatalogEntry {
  comparisonId: string;
  slug: string;
  title: string;
  toolsCompared: string[];
  comparisonCategory: string;
  summary: string;
  lastReviewedAt: string;
  editorialStatus: AiToolEditorialStatus;
  disclaimer: string;
}

export interface AiToolComparisonDetail extends AiToolComparisonCatalogEntry {
  capabilityRows: AiToolComparisonCapabilityRow[];
  pricingCaveats: string[];
  bestFor: string[];
  limitations: string[];
  sourceUrls: string[];
}

export interface AiToolsCatalogResult {
  kind: "catalog";
  message: string;
  tools: AiToolCatalogEntry[];
}

export type AiToolDetailResult =
  | {
      kind: "detail";
      message: string;
      tool: AiToolDetail;
    }
  | {
      kind: "not_found";
      message: string;
    }
  | {
      kind: "unavailable";
      message: string;
    };

export interface AiToolComparisonsCatalogResult {
  kind: "comparisons_catalog";
  message: string;
  comparisons: AiToolComparisonCatalogEntry[];
}

export type AiToolComparisonDetailResult =
  | {
      kind: "detail";
      message: string;
      comparison: AiToolComparisonDetail;
    }
  | {
      kind: "not_found";
      message: string;
    }
  | {
      kind: "unavailable";
      message: string;
    };

export interface EditorialSeoMetadataPayload {
  title: string;
  description: string;
  canonicalPath: string;
}

export type EditorialSeoMetadataBuilder = (
  payload: EditorialSeoMetadataPayload,
) => RouteSeoMetadata;
