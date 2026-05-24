import { Router } from "express";
import type { Response } from "express";
import type {
  BackendAiToolComparisonsCatalogResponse,
  BackendAiToolComparisonDetailResponse,
  BackendAiToolDetailResponse,
  BackendAiToolsCatalogResponse,
} from "../contracts/aiToolsHttpTypes";
import {
  getAiToolComparisonDetailById,
  getAiToolComparisonsCatalog,
} from "../aiTools/aiToolComparisonsCatalog";
import {
  getAiToolDetailById,
  getAiToolsCatalog,
} from "../aiTools/aiToolsCatalog";

export const createAiToolsRouter = (): Router => {
  const router = Router();

  router.get(
    "/ai-tools/catalog",
    (_request, response: Response<BackendAiToolsCatalogResponse>) => {
      response.status(200).json({
        kind: "ai_tools_catalog",
        message:
          "AI tools catalog is a static editorial directory only. It does not rank tools, trigger providers, or claim live integration.",
        tools: getAiToolsCatalog(),
      });
    },
  );

  router.get(
    "/ai-tools/comparisons",
    (_request, response: Response<BackendAiToolComparisonsCatalogResponse>) => {
      response.status(200).json({
        kind: "ai_tool_comparisons_catalog",
        message:
          "Comparison pages are editorial summaries only. Verify pricing, capability, and plan details with official provider sources.",
        comparisons: getAiToolComparisonsCatalog(),
      });
    },
  );

  router.get(
    "/ai-tools/comparisons/:comparisonId",
    (request, response: Response<BackendAiToolComparisonDetailResponse>) => {
      const comparison = getAiToolComparisonDetailById(request.params.comparisonId);

      if (!comparison) {
        response.status(404).json({
          kind: "ai_tool_comparison_not_found",
          message: "Comparison detail was not found.",
        });
        return;
      }

      response.status(200).json({
        kind: "ai_tool_comparison_detail",
        message:
          "Comparison detail is editorial only. No rankings, reviews, or generation execution are provided here.",
        comparison,
      });
    },
  );

  router.get(
    "/ai-tools/:toolId",
    (request, response: Response<BackendAiToolDetailResponse>) => {
      const tool = getAiToolDetailById(request.params.toolId);

      if (!tool) {
        response.status(404).json({
          kind: "ai_tool_not_found",
          message: "AI tool detail was not found.",
        });
        return;
      }

      response.status(200).json({
        kind: "ai_tool_detail",
        message:
          "AI tool detail is editorial only. Verify official provider sources before relying on capabilities, pricing, or integration assumptions.",
        tool,
      });
    },
  );

  return router;
};
