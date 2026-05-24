import type {
  BackendTemplateCatalogEntry,
  BackendTemplateDetail,
} from "../contracts/templateCatalogHttpTypes";

const templateCatalog: BackendTemplateDetail[] = [
  {
    templateId: "template-social-launch-cut",
    slug: "social-launch-cut",
    title: "Social launch cut",
    description:
      "A short social video structure for announcing a launch with headline text, product media, and a closing CTA frame.",
    category: "social_video",
    useCase: "Short launch teaser for social channels.",
    acceptedAssetTypes: ["image", "video", "logo"],
    outputType: "short_video",
    providerCapabilityRequirements: ["video_generation", "image_generation"],
    draftCreditEstimate: {
      label: "250-400 credits",
      planningOnly: true,
    },
    status: "planned",
    version: "0.1.0",
    createdAt: "2026-05-23T00:00:00.000Z",
    updatedAt: "2026-05-23T00:00:00.000Z",
    sampleLabel: "Static sample content only",
    requiredInputs: [
      {
        kind: "text_field",
        fieldId: "headline",
        label: "Headline",
        description: "Primary launch message shown in the opener.",
        placeholder: "Launch your next release",
        required: true,
        validationRules: [
          { type: "required", message: "Headline is required." },
          { type: "max_length", value: 90, message: "Keep headline under 90 characters." },
        ],
        capabilityRequirements: [],
      },
      {
        kind: "media_slot",
        fieldId: "hero_media",
        label: "Hero media",
        description: "Primary image or short source clip for the launch moment.",
        required: true,
        acceptedAssetTypes: ["image", "video"],
        validationRules: [
          { type: "required", message: "Hero media is required." },
          {
            type: "accepted_asset_types",
            value: ["image", "video"],
            message: "Hero media must be an image or video asset.",
          },
        ],
        capabilityRequirements: [
          {
            capability: "video_generation",
            reason: "Template output is a short video composition.",
          },
        ],
      },
      {
        kind: "option_group",
        fieldId: "aspect_ratio",
        label: "Aspect ratio",
        description: "Planning-only aspect ratio choice for the template.",
        required: true,
        options: ["9:16", "1:1", "16:9"],
        validationRules: [{ type: "required", message: "Aspect ratio choice is required." }],
        capabilityRequirements: [],
      },
    ],
    renderRequirements: {
      requiresGenerationRuntime: true,
      requiresRenderVerification: true,
      requiresBackendDeliveryDescriptor: true,
      notes: [
        "Final template output must use the same backend generation runtime as Mixer scenes later.",
        "Render success must still require verified artifact metadata and delivery readiness.",
      ],
    },
    safetyLabels: [
      "static_sample_only",
      "requires_rights_cleared_assets",
      "generation_not_enabled_yet",
      "no_public_delivery",
    ],
  },
  {
    templateId: "template-product-before-after",
    slug: "product-before-after",
    title: "Before and after product reveal",
    description:
      "A comparison-oriented template for product transformations using before, after, and short caption slots.",
    category: "product_story",
    useCase: "Product reveal or feature transformation story.",
    acceptedAssetTypes: ["image", "video"],
    outputType: "video_scene",
    providerCapabilityRequirements: ["image_generation", "video_generation"],
    draftCreditEstimate: {
      label: "500-800 credits",
      planningOnly: true,
    },
    status: "planned",
    version: "0.1.0",
    createdAt: "2026-05-23T00:00:00.000Z",
    updatedAt: "2026-05-23T00:00:00.000Z",
    sampleLabel: "Static sample content only",
    requiredInputs: [
      {
        kind: "media_slot",
        fieldId: "before_asset",
        label: "Before asset",
        description: "Image or clip representing the starting state.",
        required: true,
        acceptedAssetTypes: ["image", "video"],
        validationRules: [{ type: "required", message: "Before asset is required." }],
        capabilityRequirements: [],
      },
      {
        kind: "media_slot",
        fieldId: "after_asset",
        label: "After asset",
        description: "Image or clip representing the improved result.",
        required: true,
        acceptedAssetTypes: ["image", "video"],
        validationRules: [{ type: "required", message: "After asset is required." }],
        capabilityRequirements: [],
      },
      {
        kind: "text_field",
        fieldId: "cta_text",
        label: "Call to action",
        description: "Short closer shown at the end.",
        required: true,
        validationRules: [
          { type: "required", message: "CTA text is required." },
          { type: "max_length", value: 60, message: "Keep CTA text under 60 characters." },
        ],
        capabilityRequirements: [],
      },
    ],
    renderRequirements: {
      requiresGenerationRuntime: true,
      requiresRenderVerification: true,
      requiresBackendDeliveryDescriptor: true,
      notes: [
        "Template should later reserve platform credits before provider generation.",
        "Fallback must not silently double-burn providers or credits.",
      ],
    },
    safetyLabels: [
      "static_sample_only",
      "requires_rights_cleared_assets",
      "generation_not_enabled_yet",
    ],
  },
  {
    templateId: "template-ugc-testimonial",
    slug: "ugc-testimonial-cut",
    title: "UGC testimonial cut",
    description:
      "A UGC-style testimonial template with avatar/logo, customer quote, and closing brand message.",
    category: "ugc",
    useCase: "Testimonial short with lightweight branding.",
    acceptedAssetTypes: ["image", "video", "logo"],
    outputType: "short_video",
    providerCapabilityRequirements: ["video_generation", "audio_generation"],
    draftCreditEstimate: {
      label: "250-400 credits",
      planningOnly: true,
    },
    status: "draft",
    version: "0.1.0",
    createdAt: "2026-05-23T00:00:00.000Z",
    updatedAt: "2026-05-23T00:00:00.000Z",
    sampleLabel: "Static sample content only",
    requiredInputs: [
      {
        kind: "text_field",
        fieldId: "quote_text",
        label: "Quote",
        description: "Customer quote shown on-screen.",
        required: true,
        validationRules: [
          { type: "required", message: "Quote text is required." },
          { type: "max_length", value: 180, message: "Keep quote text under 180 characters." },
        ],
        capabilityRequirements: [],
      },
      {
        kind: "media_slot",
        fieldId: "brand_logo",
        label: "Brand logo",
        description: "Optional logo placement for the closer.",
        required: false,
        acceptedAssetTypes: ["logo", "image"],
        validationRules: [],
        capabilityRequirements: [],
      },
    ],
    renderRequirements: {
      requiresGenerationRuntime: true,
      requiresRenderVerification: true,
      requiresBackendDeliveryDescriptor: true,
      notes: [
        "Audio remains optional and provider-capability based, not a separate early setup step.",
      ],
    },
    safetyLabels: [
      "static_sample_only",
      "generation_not_enabled_yet",
      "requires_rights_cleared_assets",
    ],
  },
  {
    templateId: "template-photo-motion-board",
    slug: "photo-motion-board",
    title: "Photo motion board",
    description:
      "A planning shell for turning still images into a motion-driven board with text overlays and pacing options.",
    category: "photo_motion",
    useCase: "Photo-based motion storyboard.",
    acceptedAssetTypes: ["image"],
    outputType: "short_video",
    providerCapabilityRequirements: ["image_generation", "video_generation"],
    draftCreditEstimate: {
      label: "900-1500 credits",
      planningOnly: true,
    },
    status: "unavailable",
    version: "0.1.0",
    createdAt: "2026-05-23T00:00:00.000Z",
    updatedAt: "2026-05-23T00:00:00.000Z",
    sampleLabel: "Static sample content only",
    requiredInputs: [
      {
        kind: "media_slot",
        fieldId: "photo_set",
        label: "Photo set",
        description: "Planning-only slot for the still image sequence.",
        required: true,
        acceptedAssetTypes: ["image"],
        validationRules: [
          { type: "required", message: "At least one photo asset is required." },
          {
            type: "accepted_asset_types",
            value: ["image"],
            message: "Only image assets are supported for this planning shell.",
          },
        ],
        capabilityRequirements: [],
      },
    ],
    renderRequirements: {
      requiresGenerationRuntime: true,
      requiresRenderVerification: true,
      requiresBackendDeliveryDescriptor: true,
      notes: [
        "This template remains unavailable until truthful photo-motion generation and render wiring exist.",
      ],
    },
    safetyLabels: [
      "static_sample_only",
      "generation_not_enabled_yet",
      "no_public_delivery",
    ],
  },
];

export const getTemplateCatalog = (): BackendTemplateCatalogEntry[] =>
  templateCatalog.map(
    ({
      requiredInputs: _requiredInputs,
      renderRequirements: _renderRequirements,
      safetyLabels: _safetyLabels,
      ...entry
    }) => entry,
  );

export const getTemplateDetailById = (
  templateId: string,
): BackendTemplateDetail | undefined =>
  templateCatalog.find((template) => template.templateId === templateId);
