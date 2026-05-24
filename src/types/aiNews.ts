import type { RouteSeoMetadata } from "./seo";

export type AiNewsEditorialStatus =
  | "draft"
  | "published"
  | "needs_review"
  | "archived";

export interface AiNewsFeedItem {
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
  status: AiNewsEditorialStatus;
}

export interface AiNewsFeedResult {
  kind: "feed";
  message: string;
  items: AiNewsFeedItem[];
}

export type AiNewsDetailResult =
  | {
      kind: "detail";
      message: string;
      item: AiNewsFeedItem;
    }
  | {
      kind: "not_found";
      message: string;
    }
  | {
      kind: "unavailable";
      message: string;
    };

export type AiNewsSeoMetadataBuilder = (
  payload: {
    title: string;
    description: string;
    canonicalPath: string;
  },
) => RouteSeoMetadata;
