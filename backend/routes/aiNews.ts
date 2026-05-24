import { Router } from "express";
import type { Response } from "express";
import type {
  BackendAiNewsDetailResponse,
  BackendAiNewsFeedResponse,
} from "../contracts/aiNewsHttpTypes";
import { getAiNewsDetailById, getAiNewsFeed } from "../aiNews/aiNewsCatalog";

export const createAiNewsRouter = (): Router => {
  const router = Router();

  router.get(
    "/ai-news/feed",
    (_request, response: Response<BackendAiNewsFeedResponse>) => {
      response.status(200).json({
        kind: "ai_news_feed",
        message:
          "AI news feed is a static editorial shell only. No live feed ingestion, scraping, or external fetching happens at request time.",
        items: getAiNewsFeed(),
      });
    },
  );

  router.get(
    "/ai-news/:feedItemId",
    (request, response: Response<BackendAiNewsDetailResponse>) => {
      const item = getAiNewsDetailById(request.params.feedItemId);

      if (!item) {
        response.status(404).json({
          kind: "ai_news_not_found",
          message: "AI news detail was not found.",
        });
        return;
      }

      response.status(200).json({
        kind: "ai_news_detail",
        message:
          "AI news detail is a short editorial summary only. Verify source pages for current details and avoid treating it as a live latest-feed claim.",
        item,
      });
    },
  );

  return router;
};
