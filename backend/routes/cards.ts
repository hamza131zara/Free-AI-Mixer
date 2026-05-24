import { Router } from "express";
import type { Response } from "express";
import type {
  BackendCardTemplateDetailResponse,
  BackendCardsCatalogResponse,
} from "../contracts/cardsHttpTypes";
import {
  getCardTemplateCatalog,
  getCardTemplateDetailById,
} from "../cards/cardTemplateCatalog";

export const createCardsRouter = (): Router => {
  const router = Router();

  router.get(
    "/cards/catalog",
    (_request, response: Response<BackendCardsCatalogResponse>) => {
      response.status(200).json({
        kind: "cards_catalog",
        message:
          "Card templates are available as a static local-preview catalog only. No AI generation, download, share, QR code, or persistence is enabled.",
        templates: getCardTemplateCatalog(),
      });
    },
  );

  router.get(
    "/cards/:templateId",
    (request, response: Response<BackendCardTemplateDetailResponse>) => {
      const template = getCardTemplateDetailById(request.params.templateId);

      if (!template) {
        response.status(404).json({
          kind: "card_template_not_found",
          message: "Card template detail was not found.",
        });
        return;
      }

      response.status(200).json({
        kind: "card_template_detail",
        message:
          "Card template detail is available for local preview planning only. Download, share, QR code, and project saving are not enabled yet.",
        template,
      });
    },
  );

  return router;
};
