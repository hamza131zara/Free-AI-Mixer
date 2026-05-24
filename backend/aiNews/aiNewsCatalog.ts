import type { BackendAiNewsFeedItem } from "../contracts/aiNewsHttpTypes";

const aiNewsCatalog: BackendAiNewsFeedItem[] = [
  {
    feedItemId: "news-openai-product-updates-editorial-note",
    slug: "openai-product-updates-editorial-note",
    title: "OpenAI product updates: editorial note",
    summary:
      "Short editorial summary page pattern for notable provider updates, with source attribution and visible last-checked metadata.",
    category: "product_update",
    sourceName: "OpenAI",
    sourceUrl: "https://openai.com/news",
    publishedAt: "2026-05-20T00:00:00.000Z",
    lastCheckedAt: "2026-05-23T00:00:00.000Z",
    editorialNote:
      "Short summary only. Readers should verify the latest details directly with the official source.",
    status: "published",
  },
  {
    feedItemId: "news-ai-video-platform-roundup-shell",
    slug: "ai-video-platform-roundup-shell",
    title: "AI video platform roundup shell",
    summary:
      "Editorial shell entry for tracking notable video-generation announcements without claiming live freshness or scraping external feeds.",
    category: "roundup",
    sourceName: "Editorial catalog",
    sourceUrl: "https://www.freeaimixer.com/ai-news",
    publishedAt: "2026-05-18T00:00:00.000Z",
    lastCheckedAt: "2026-05-23T00:00:00.000Z",
    editorialNote:
      "This entry remains a manual editorial shell. It is not an automatically updated live feed item.",
    status: "needs_review",
  },
];

export const getAiNewsFeed = (): BackendAiNewsFeedItem[] => aiNewsCatalog;

export const getAiNewsDetailById = (
  feedItemId: string,
): BackendAiNewsFeedItem | undefined =>
  aiNewsCatalog.find((item) => item.feedItemId === feedItemId);
