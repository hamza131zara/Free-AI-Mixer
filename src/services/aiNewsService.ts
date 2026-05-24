import type { RouteSeoMetadata } from "../types/seo";
import type {
  AiNewsDetailResult,
  AiNewsFeedItem,
  AiNewsFeedResult,
} from "../types/aiNews";

type BackendAiNewsFeedItem = AiNewsFeedItem;

interface BackendAiNewsFeedResponse {
  kind: "ai_news_feed";
  message?: string;
  items: BackendAiNewsFeedItem[];
}

interface BackendAiNewsDetailPayload {
  kind: "ai_news_detail";
  message?: string;
  item: BackendAiNewsFeedItem;
}

interface BackendAiNewsNotFoundPayload {
  kind: "ai_news_not_found";
  message?: string;
}

type BackendAiNewsDetailResponse =
  | BackendAiNewsDetailPayload
  | BackendAiNewsNotFoundPayload;

const parseJson = async <Payload>(response: Response): Promise<Payload | undefined> => {
  const responseText = await response.text();

  if (!responseText) {
    return undefined;
  }

  try {
    return JSON.parse(responseText) as Payload;
  } catch {
    return undefined;
  }
};

const buildEditorialSeoMetadata = (
  title: string,
  description: string,
  canonicalPath: string,
): RouteSeoMetadata => ({
  title,
  description,
  canonicalPath,
  indexable: true,
  includeInSitemap: false,
  robots: "index,follow",
});

export const getAiNewsSlugFromPath = (pathname: string): string | undefined => {
  const match = pathname.match(/^\/ai-news\/([^/]+)$/);
  return match?.[1];
};

export const buildAiNewsDetailSeoMetadata = (
  item: AiNewsFeedItem,
): RouteSeoMetadata =>
  buildEditorialSeoMetadata(
    `${item.title} | AI News | Free AI Mixer`,
    `${item.summary} Source-linked editorial note with last-checked metadata.`,
    `/ai-news/${item.slug}`,
  );

export const getAiNewsFeed = async (): Promise<AiNewsFeedResult> => {
  try {
    const response = await fetch("/ai-news/feed", {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendAiNewsFeedResponse>(response);

    if (!response.ok || !payload || payload.kind !== "ai_news_feed") {
      return {
        kind: "feed",
        message: "AI news feed is currently unavailable.",
        items: [],
      };
    }

    return {
      kind: "feed",
      message:
        payload.message ??
        "AI news feed is a static editorial shell only.",
      items: payload.items,
    };
  } catch {
    return {
      kind: "feed",
      message: "AI news feed is currently unavailable.",
      items: [],
    };
  }
};

export const getAiNewsDetail = async (
  feedItemId: string,
): Promise<AiNewsDetailResult> => {
  try {
    const response = await fetch(`/ai-news/${encodeURIComponent(feedItemId)}`, {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendAiNewsDetailResponse>(response);

    if (response.status === 404 || payload?.kind === "ai_news_not_found") {
      return {
        kind: "not_found",
        message: payload?.message ?? "AI news detail was not found.",
      };
    }

    if (!response.ok || !payload || payload.kind !== "ai_news_detail") {
      return {
        kind: "unavailable",
        message: "AI news detail is currently unavailable.",
      };
    }

    return {
      kind: "detail",
      message:
        payload.message ??
        "AI news detail is available in editorial form only.",
      item: payload.item,
    };
  } catch {
    return {
      kind: "unavailable",
      message: "AI news detail is currently unavailable.",
    };
  }
};

export const getAiNewsDetailBySlug = async (
  slug: string,
): Promise<AiNewsDetailResult> => {
  const feed = await getAiNewsFeed();
  const match = feed.items.find((item) => item.slug === slug);

  if (!match) {
    return {
      kind: "not_found",
      message: "AI news detail was not found.",
    };
  }

  return getAiNewsDetail(match.feedItemId);
};
