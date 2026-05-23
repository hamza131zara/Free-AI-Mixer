import { Router } from "express";
import type { Response } from "express";
import type {
  BackendTemplateCatalogResponse,
  BackendTemplateDetailResponse,
} from "../contracts/templateCatalogHttpTypes";
import {
  getTemplateCatalog,
  getTemplateDetailById,
} from "../templates/templateCatalog";

export const createTemplatesRouter = (): Router => {
  const router = Router();

  router.get(
    "/templates/catalog",
    (_request, response: Response<BackendTemplateCatalogResponse>) => {
      response.status(200).json({
        kind: "template_catalog",
        message:
          "Static template metadata is available for planning and gallery browsing only. No template generation or project creation is enabled.",
        templates: getTemplateCatalog(),
      });
    },
  );

  router.get(
    "/templates/:templateId",
    (request, response: Response<BackendTemplateDetailResponse>) => {
      const template = getTemplateDetailById(request.params.templateId);

      if (!template) {
        response.status(404).json({
          kind: "template_not_found",
          message: "Template detail was not found.",
        });
        return;
      }

      response.status(200).json({
        kind: "template_detail",
        message:
          "Template detail is available in planning-only form. Generation, downloads, and project saves are not enabled yet.",
        template,
      });
    },
  );

  return router;
};
