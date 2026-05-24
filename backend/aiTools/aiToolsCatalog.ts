import type {
  BackendAiToolCatalogEntry,
  BackendAiToolDetail,
} from "../contracts/aiToolsHttpTypes";

const aiToolsCatalog: BackendAiToolDetail[] = [
  {
    toolId: "tool-openai-chatgpt",
    slug: "openai-chatgpt",
    name: "ChatGPT",
    companyOrProvider: "OpenAI",
    officialWebsiteUrl: "https://chatgpt.com/",
    shortDescription:
      "General-purpose conversational assistant for writing, coding, research, and multimodal workflows.",
    categories: ["assistant", "writing", "multimodal"],
    capabilities: ["chat", "image_generation", "file_analysis", "reasoning"],
    supportedInputTypes: ["text", "image", "file"],
    supportedOutputTypes: ["text", "image", "structured_output"],
    apiAvailability: "public_api",
    byokSupportStatus: "supported",
    pricingStatus: "unknown",
    pricingSourceUrl: "https://openai.com/pricing",
    limitations: [
      "Exact pricing, limits, and feature availability should be verified on official OpenAI pages.",
      "Capability coverage may vary by plan, model, and region.",
    ],
    bestUseCases: [
      "Research assistance and drafting",
      "Coding help and structured workflows",
      "Image and multimodal experimentation",
    ],
    freeAiMixerIntegrationStatus: "planned",
    sourceUrls: ["https://openai.com/chatgpt", "https://openai.com/pricing"],
    lastReviewedAt: "2026-05-23T00:00:00.000Z",
    lastUpdatedAt: "2026-05-23T00:00:00.000Z",
    editorialStatus: "published",
    disclaimer:
      "Editorial summary only. Verify capabilities, pricing, and plan details with the official provider.",
  },
  {
    toolId: "tool-runway",
    slug: "runway",
    name: "Runway",
    companyOrProvider: "Runway",
    officialWebsiteUrl: "https://runwayml.com/",
    shortDescription:
      "Creative AI platform focused on video generation, editing, and media production workflows.",
    categories: ["video_generation", "editing", "creative_suite"],
    capabilities: ["video_generation", "image_generation", "editing_tools"],
    supportedInputTypes: ["text", "image", "video"],
    supportedOutputTypes: ["video", "image"],
    apiAvailability: "limited_api",
    byokSupportStatus: "unknown",
    pricingStatus: "unknown",
    pricingSourceUrl: "https://runwayml.com/pricing/",
    limitations: [
      "API and enterprise availability should be checked directly with the provider.",
      "Feature sets can differ across plans and release tracks.",
    ],
    bestUseCases: [
      "Short-form motion generation",
      "Creative video iteration",
      "Video-first production workflows",
    ],
    freeAiMixerIntegrationStatus: "unknown",
    sourceUrls: ["https://runwayml.com/", "https://runwayml.com/pricing/"],
    lastReviewedAt: "2026-05-23T00:00:00.000Z",
    lastUpdatedAt: "2026-05-23T00:00:00.000Z",
    editorialStatus: "published",
    disclaimer:
      "Editorial summary only. Unknown fields remain unknown until reviewed against official provider sources.",
  },
  {
    toolId: "tool-midjourney",
    slug: "midjourney",
    name: "Midjourney",
    companyOrProvider: "Midjourney",
    officialWebsiteUrl: "https://www.midjourney.com/",
    shortDescription:
      "Image-generation product known for stylized visual outputs and prompt-driven exploration.",
    categories: ["image_generation", "creative_tool"],
    capabilities: ["image_generation"],
    supportedInputTypes: ["text", "image"],
    supportedOutputTypes: ["image"],
    apiAvailability: "unknown",
    byokSupportStatus: "not_supported",
    pricingStatus: "unknown",
    pricingSourceUrl: "https://www.midjourney.com/pricing",
    limitations: [
      "Public API availability should be treated as unknown unless verified with official Midjourney documentation.",
      "Workflow assumptions should not be inferred from community usage alone.",
    ],
    bestUseCases: [
      "Concept art exploration",
      "Visual style ideation",
      "Prompt-based image iteration",
    ],
    freeAiMixerIntegrationStatus: "not_supported",
    sourceUrls: [
      "https://www.midjourney.com/",
      "https://www.midjourney.com/pricing",
    ],
    lastReviewedAt: "2026-05-23T00:00:00.000Z",
    lastUpdatedAt: "2026-05-23T00:00:00.000Z",
    editorialStatus: "needs_review",
    disclaimer:
      "Editorial summary only. Pricing, access, and integration assumptions must be verified with the official provider.",
  },
];

export const getAiToolsCatalog = (): BackendAiToolCatalogEntry[] =>
  aiToolsCatalog.map(({ limitations: _limitations, bestUseCases: _bestUseCases, ...entry }) => entry);

export const getAiToolDetailById = (
  toolId: string,
): BackendAiToolDetail | undefined =>
  aiToolsCatalog.find((tool) => tool.toolId === toolId);
