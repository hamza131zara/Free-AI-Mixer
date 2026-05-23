import type { ProviderCapability } from "./providerSettings";

export type TemplateCategory =
  | "social_video"
  | "product_story"
  | "ugc"
  | "photo_motion"
  | "brand_intro";

export type TemplateAssetType = "image" | "video" | "logo" | "audio";

export type TemplateOutputType = "image_scene" | "video_scene" | "short_video";

export type TemplateStatus = "draft" | "planned" | "available" | "unavailable";

export type TemplateSafetyLabel =
  | "static_sample_only"
  | "requires_rights_cleared_assets"
  | "no_public_delivery"
  | "generation_not_enabled_yet";

export interface TemplateDraftCreditEstimate {
  label: string;
  planningOnly: true;
}

export interface TemplateRenderRequirement {
  requiresGenerationRuntime: boolean;
  requiresRenderVerification: boolean;
  requiresBackendDeliveryDescriptor: boolean;
  notes: string[];
}

export interface TemplateInputValidationRule {
  type:
    | "required"
    | "min_length"
    | "max_length"
    | "accepted_asset_types"
    | "capability_requirement";
  value?: string | number | string[];
  message: string;
}

export interface TemplateInputCapabilityRequirement {
  capability: ProviderCapability;
  reason: string;
}

export type TemplateInputField =
  | {
      kind: "text_field";
      fieldId: string;
      label: string;
      description: string;
      placeholder?: string;
      required: boolean;
      validationRules: TemplateInputValidationRule[];
      capabilityRequirements: TemplateInputCapabilityRequirement[];
    }
  | {
      kind: "media_slot";
      fieldId: string;
      label: string;
      description: string;
      required: boolean;
      acceptedAssetTypes: TemplateAssetType[];
      validationRules: TemplateInputValidationRule[];
      capabilityRequirements: TemplateInputCapabilityRequirement[];
    }
  | {
      kind: "option_group";
      fieldId: string;
      label: string;
      description: string;
      required: boolean;
      options: string[];
      validationRules: TemplateInputValidationRule[];
      capabilityRequirements: TemplateInputCapabilityRequirement[];
    };

export interface TemplateCatalogEntry {
  templateId: string;
  slug: string;
  title: string;
  description: string;
  category: TemplateCategory;
  useCase: string;
  acceptedAssetTypes: TemplateAssetType[];
  outputType: TemplateOutputType;
  providerCapabilityRequirements: ProviderCapability[];
  draftCreditEstimate: TemplateDraftCreditEstimate;
  status: TemplateStatus;
  version: string;
  createdAt: string;
  updatedAt: string;
  sampleLabel: "Static sample content only";
}

export interface TemplateDetail extends TemplateCatalogEntry {
  requiredInputs: TemplateInputField[];
  renderRequirements: TemplateRenderRequirement;
  safetyLabels: TemplateSafetyLabel[];
}

export interface TemplateCatalogResult {
  kind: "catalog";
  message: string;
  templates: TemplateCatalogEntry[];
}

export type TemplateDetailResult =
  | {
      kind: "detail";
      message: string;
      template: TemplateDetail;
    }
  | {
      kind: "not_found";
      message: string;
    }
  | {
      kind: "unavailable";
      message: string;
    };
