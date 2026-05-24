export type BackendAiNewsEditorialStatus =
  | "draft"
  | "published"
  | "needs_review"
  | "archived";

export interface BackendAiNewsFeedItem {
  feedItemId: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  lastCheckedAt: string;
  editorialNote: string;
  status: BackendAiNewsEditorialStatus;
}

export interface BackendAiNewsFeedResponse {
  kind: "ai_news_feed";
  message: string;
  items: BackendAiNewsFeedItem[];
}

export type BackendAiNewsDetailResponse =
  | {
      kind: "ai_news_detail";
      message: string;
      item: BackendAiNewsFeedItem;
    }
  | {
      kind: "ai_news_not_found";
      message: string;
    };
