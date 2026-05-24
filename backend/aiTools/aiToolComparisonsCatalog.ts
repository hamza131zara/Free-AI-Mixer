import type {
  BackendAiToolComparisonCatalogEntry,
  BackendAiToolComparisonDetail,
} from "../contracts/aiToolsHttpTypes";

const aiToolComparisonsCatalog: BackendAiToolComparisonDetail[] = [
  {
    comparisonId: "comparison-chatgpt-vs-runway",
    slug: "chatgpt-vs-runway-for-creative-workflows",
    title: "ChatGPT vs Runway for creative workflows",
    toolsCompared: ["ChatGPT", "Runway"],
    comparisonCategory: "creative_workflows",
    summary:
      "Editorial comparison of how a general-purpose assistant and a video-first creative suite differ in workflow fit, not a universal best-of ranking.",
    capabilityRows: [
      {
        label: "Primary strength",
        values: {
          ChatGPT: "General-purpose reasoning and drafting",
          Runway: "Video-focused creation and editing",
        },
      },
      {
        label: "Output emphasis",
        values: {
          ChatGPT: "Text, structured output, and some multimodal workflows",
          Runway: "Video and image media outputs",
        },
      },
      {
        label: "Pricing certainty",
        values: {
          ChatGPT: "Verify official pricing pages",
          Runway: "Verify official pricing pages",
        },
      },
    ],
    pricingCaveats: [
      "Exact prices and included limits should be verified with official provider pricing pages.",
      "Plan names, regions, or enterprise tiers may change over time.",
    ],
    bestFor: [
      "Teams comparing assistant-led workflows to video-first creation tools",
      "Readers who want editorial caveats before trying a provider",
    ],
    limitations: [
      "This page is an editorial summary, not a benchmark or independent certification.",
      "Capabilities, policies, and pricing can change between reviews.",
    ],
    sourceUrls: [
      "https://openai.com/chatgpt",
      "https://openai.com/pricing",
      "https://runwayml.com/",
      "https://runwayml.com/pricing/",
    ],
    lastReviewedAt: "2026-05-23T00:00:00.000Z",
    editorialStatus: "published",
    disclaimer:
      "Editorial comparison only. Verify pricing, capabilities, and suitability with the official providers.",
  },
  {
    comparisonId: "comparison-runway-vs-midjourney-visual-generation",
    slug: "runway-vs-midjourney-for-visual-generation",
    title: "Runway vs Midjourney for visual generation",
    toolsCompared: ["Runway", "Midjourney"],
    comparisonCategory: "visual_generation",
    summary:
      "Editorial comparison focused on workflow differences between a video-led platform and an image-led creative tool.",
    capabilityRows: [
      {
        label: "Media focus",
        values: {
          Runway: "Video-led",
          Midjourney: "Image-led",
        },
      },
      {
        label: "API certainty",
        values: {
          Runway: "Limited or enterprise-dependent",
          Midjourney: "Unknown unless verified",
        },
      },
    ],
    pricingCaveats: [
      "Unknown fields remain unknown until reviewed against official provider sources.",
    ],
    bestFor: [
      "Editorial comparison of visual generation workflows",
      "Readers who want caveats instead of ratings",
    ],
    limitations: [
      "No benchmark score or popularity ranking is provided.",
      "Source review is required before relying on integration or API assumptions.",
    ],
    sourceUrls: [
      "https://runwayml.com/",
      "https://runwayml.com/pricing/",
      "https://www.midjourney.com/",
      "https://www.midjourney.com/pricing",
    ],
    lastReviewedAt: "2026-05-23T00:00:00.000Z",
    editorialStatus: "published",
    disclaimer:
      "Editorial comparison only. Verify with official provider sources before making product or purchasing decisions.",
  },
];

export const getAiToolComparisonsCatalog = (): BackendAiToolComparisonCatalogEntry[] =>
  aiToolComparisonsCatalog.map(
    ({
      capabilityRows: _capabilityRows,
      pricingCaveats: _pricingCaveats,
      bestFor: _bestFor,
      limitations: _limitations,
      ...entry
    }) => entry,
  );

export const getAiToolComparisonDetailById = (
  comparisonId: string,
): BackendAiToolComparisonDetail | undefined =>
  aiToolComparisonsCatalog.find((comparison) => comparison.comparisonId === comparisonId);
