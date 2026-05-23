import type { BackendProviderCapability } from "./providerSettingsHttpTypes";

export type BackendTemplateCategory =
  | "social_video"
  | "product_story"
  | "ugc"
  | "photo_motion"
  | "brand_intro";

export type BackendTemplateAssetType = "image" | "video" | "logo" | "audio";

export type BackendTemplateOutputType = "image_scene" | "video_scene" | "short_video";

export type BackendTemplateStatus = "draft" | "planned" | "available" | "unavailable";

export type BackendTemplateSafetyLabel =
  | "static_sample_only"
  | "requires_rights_cleared_assets"
  | "no_public_delivery"
  | "generation_not_enabled_yet";

export interface BackendTemplateDraftCreditEstimate {
  label: string;
  planningOnly: true;
}

export interface BackendTemplateInputValidationRule {
  type:
    | "required"
    | "min_length"
    | "max_length"
    | "accepted_asset_types"
    | "capability_requirement";
  value?: string | number | string[];
  message: string;
}

export interface BackendTemplateInputCapabilityRequirement {
  capability: BackendProviderCapability;
  reason: string;
}

export type BackendTemplateInputField =
  | {
      kind: "text_field";
      fieldId: string;
      label: string;
      description: string;
      placeholder?: string;
      required: boolean;
      validationRules: BackendTemplateInputValidationRule[];
      capabilityRequirements: BackendTemplateInputCapabilityRequirement[];
    }
  | {
      kind: "media_slot";
      fieldId: string;
      label: string;
      description: string;
      required: boolean;
      acceptedAssetTypes: BackendTemplateAssetType[];
      validationRules: BackendTemplateInputValidationRule[];
      capabilityRequirements: BackendTemplateInputCapabilityRequirement[];
    }
  | {
      kind: "option_group";
      fieldId: string;
      label: string;
      description: string;
      required: boolean;
      options: string[];
      validationRules: BackendTemplateInputValidationRule[];
      capabilityRequirements: BackendTemplateInputCapabilityRequirement[];
    };

export interface BackendTemplateRenderRequirement {
  requiresGenerationRuntime: boolean;
  requiresRenderVerification: boolean;
  requiresBackendDeliveryDescriptor: boolean;
  notes: string[];
}

export interface BackendTemplateCatalogEntry {
  templateId: string;
  slug: string;
  title: string;
  description: string;
  category: BackendTemplateCategory;
  useCase: string;
  acceptedAssetTypes: BackendTemplateAssetType[];
  outputType: BackendTemplateOutputType;
  providerCapabilityRequirements: BackendProviderCapability[];
  draftCreditEstimate: BackendTemplateDraftCreditEstimate;
  status: BackendTemplateStatus;
  version: string;
  createdAt: string;
  updatedAt: string;
  sampleLabel: "Static sample content only";
}

export interface BackendTemplateDetail extends BackendTemplateCatalogEntry {
  requiredInputs: BackendTemplateInputField[];
  renderRequirements: BackendTemplateRenderRequirement;
  safetyLabels: BackendTemplateSafetyLabel[];
}

export interface BackendTemplateCatalogResponse {
  kind: "template_catalog";
  message: string;
  templates: BackendTemplateCatalogEntry[];
}

export type BackendTemplateDetailResponse =
  | {
      kind: "template_detail";
      message: string;
      template: BackendTemplateDetail;
    }
  | {
      kind: "template_not_found";
      message: string;
    };
