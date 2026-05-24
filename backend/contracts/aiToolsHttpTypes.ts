export type BackendAiToolPricingStatus =
  | "unknown"
  | "free"
  | "paid"
  | "freemium"
  | "contact_sales";

export type BackendAiToolApiAvailability =
  | "unknown"
  | "public_api"
  | "limited_api"
  | "no_public_api";

export type BackendAiToolByokSupportStatus =
  | "unknown"
  | "supported"
  | "limited"
  | "not_supported";

export type BackendAiToolIntegrationStatus =
  | "planned"
  | "available"
  | "not_supported"
  | "unknown";

export type BackendAiToolEditorialStatus = "draft" | "published" | "needs_review";

export interface BackendAiToolCatalogEntry {
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
  apiAvailability: BackendAiToolApiAvailability;
  byokSupportStatus: BackendAiToolByokSupportStatus;
  pricingStatus: BackendAiToolPricingStatus;
  pricingSourceUrl?: string;
  freeAiMixerIntegrationStatus: BackendAiToolIntegrationStatus;
  sourceUrls: string[];
  lastReviewedAt: string;
  lastUpdatedAt: string;
  editorialStatus: BackendAiToolEditorialStatus;
  disclaimer: string;
}

export interface BackendAiToolDetail extends BackendAiToolCatalogEntry {
  limitations: string[];
  bestUseCases: string[];
}

export interface BackendAiToolComparisonCapabilityRow {
  label: string;
  values: Record<string, string>;
}

export interface BackendAiToolComparisonDetail {
  comparisonId: string;
  slug: string;
  title: string;
  toolsCompared: string[];
  comparisonCategory: string;
  summary: string;
  capabilityRows: BackendAiToolComparisonCapabilityRow[];
  pricingCaveats: string[];
  bestFor: string[];
  limitations: string[];
  sourceUrls: string[];
  lastReviewedAt: string;
  editorialStatus: BackendAiToolEditorialStatus;
  disclaimer: string;
}

export interface BackendAiToolComparisonCatalogEntry {
  comparisonId: string;
  slug: string;
  title: string;
  toolsCompared: string[];
  comparisonCategory: string;
  summary: string;
  lastReviewedAt: string;
  editorialStatus: BackendAiToolEditorialStatus;
  disclaimer: string;
}

export interface BackendAiToolsCatalogResponse {
  kind: "ai_tools_catalog";
  message: string;
  tools: BackendAiToolCatalogEntry[];
}

export type BackendAiToolDetailResponse =
  | {
      kind: "ai_tool_detail";
      message: string;
      tool: BackendAiToolDetail;
    }
  | {
      kind: "ai_tool_not_found";
      message: string;
    };

export interface BackendAiToolComparisonsCatalogResponse {
  kind: "ai_tool_comparisons_catalog";
  message: string;
  comparisons: BackendAiToolComparisonCatalogEntry[];
}

export type BackendAiToolComparisonDetailResponse =
  | {
      kind: "ai_tool_comparison_detail";
      message: string;
      comparison: BackendAiToolComparisonDetail;
    }
  | {
      kind: "ai_tool_comparison_not_found";
      message: string;
    };
