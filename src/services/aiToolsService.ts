import type { RouteSeoMetadata } from "../types/seo";
import type {
  AiToolCatalogEntry,
  AiToolComparisonCatalogEntry,
  AiToolComparisonDetail,
  AiToolComparisonDetailResult,
  AiToolComparisonsCatalogResult,
  AiToolDetail,
  AiToolDetailResult,
  AiToolsCatalogResult,
} from "../types/aiTools";

type BackendAiToolCatalogEntry = AiToolCatalogEntry;
type BackendAiToolDetail = AiToolDetail;
type BackendAiToolComparisonCatalogEntry = AiToolComparisonCatalogEntry;
type BackendAiToolComparisonDetail = AiToolComparisonDetail;

interface BackendAiToolsCatalogResponse {
  kind: "ai_tools_catalog";
  message?: string;
  tools: BackendAiToolCatalogEntry[];
}

interface BackendAiToolDetailPayload {
  kind: "ai_tool_detail";
  message?: string;
  tool: BackendAiToolDetail;
}

interface BackendAiToolNotFoundPayload {
  kind: "ai_tool_not_found";
  message?: string;
}

interface BackendAiToolComparisonsCatalogResponse {
  kind: "ai_tool_comparisons_catalog";
  message?: string;
  comparisons: BackendAiToolComparisonCatalogEntry[];
}

interface BackendAiToolComparisonDetailPayload {
  kind: "ai_tool_comparison_detail";
  message?: string;
  comparison: BackendAiToolComparisonDetail;
}

interface BackendAiToolComparisonNotFoundPayload {
  kind: "ai_tool_comparison_not_found";
  message?: string;
}

type BackendAiToolDetailResponse =
  | BackendAiToolDetailPayload
  | BackendAiToolNotFoundPayload;

type BackendAiToolComparisonDetailResponse =
  | BackendAiToolComparisonDetailPayload
  | BackendAiToolComparisonNotFoundPayload;

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

export const getAiToolSlugFromPath = (pathname: string): string | undefined => {
  const match = pathname.match(/^\/ai-tools\/([^/]+)$/);
  return match?.[1];
};

export const getComparisonSlugFromPath = (pathname: string): string | undefined => {
  const match = pathname.match(/^\/compare\/([^/]+)$/);
  return match?.[1];
};

export const buildAiToolDetailSeoMetadata = (
  tool: AiToolDetail,
): RouteSeoMetadata =>
  buildEditorialSeoMetadata(
    `${tool.name} | AI Tools Directory | Free AI Mixer`,
    `${tool.shortDescription} Editorial summary with sources, limitations, and last-reviewed metadata.`,
    `/ai-tools/${tool.slug}`,
  );

export const buildAiToolComparisonSeoMetadata = (
  comparison: AiToolComparisonDetail,
): RouteSeoMetadata =>
  buildEditorialSeoMetadata(
    `${comparison.title} | AI Tools Compare | Free AI Mixer`,
    `${comparison.summary} Editorial comparison with caveats, sources, and last-reviewed metadata.`,
    `/compare/${comparison.slug}`,
  );

export const getAiToolsCatalog = async (): Promise<AiToolsCatalogResult> => {
  try {
    const response = await fetch("/ai-tools/catalog", {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendAiToolsCatalogResponse>(response);

    if (!response.ok || !payload || payload.kind !== "ai_tools_catalog") {
      return {
        kind: "catalog",
        message: "AI tools catalog is currently unavailable.",
        tools: [],
      };
    }

    return {
      kind: "catalog",
      message:
        payload.message ??
        "AI tools catalog is a static editorial directory only.",
      tools: payload.tools,
    };
  } catch {
    return {
      kind: "catalog",
      message: "AI tools catalog is currently unavailable.",
      tools: [],
    };
  }
};

export const getAiToolDetail = async (
  toolId: string,
): Promise<AiToolDetailResult> => {
  try {
    const response = await fetch(`/ai-tools/${encodeURIComponent(toolId)}`, {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendAiToolDetailResponse>(response);

    if (response.status === 404 || payload?.kind === "ai_tool_not_found") {
      return {
        kind: "not_found",
        message: payload?.message ?? "AI tool detail was not found.",
      };
    }

    if (!response.ok || !payload || payload.kind !== "ai_tool_detail") {
      return {
        kind: "unavailable",
        message: "AI tool detail is currently unavailable.",
      };
    }

    return {
      kind: "detail",
      message:
        payload.message ??
        "AI tool detail is available in editorial form only.",
      tool: payload.tool,
    };
  } catch {
    return {
      kind: "unavailable",
      message: "AI tool detail is currently unavailable.",
    };
  }
};

export const getAiToolDetailBySlug = async (
  slug: string,
): Promise<AiToolDetailResult> => {
  const catalog = await getAiToolsCatalog();
  const match = catalog.tools.find((tool) => tool.slug === slug);

  if (!match) {
    return {
      kind: "not_found",
      message: "AI tool detail was not found.",
    };
  }

  return getAiToolDetail(match.toolId);
};

export const getAiToolComparisonsCatalog = async (): Promise<AiToolComparisonsCatalogResult> => {
  try {
    const response = await fetch("/ai-tools/comparisons", {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendAiToolComparisonsCatalogResponse>(response);

    if (!response.ok || !payload || payload.kind !== "ai_tool_comparisons_catalog") {
      return {
        kind: "comparisons_catalog",
        message: "AI tools comparison catalog is currently unavailable.",
        comparisons: [],
      };
    }

    return {
      kind: "comparisons_catalog",
      message:
        payload.message ??
        "Comparison pages are editorial summaries only.",
      comparisons: payload.comparisons,
    };
  } catch {
    return {
      kind: "comparisons_catalog",
      message: "AI tools comparison catalog is currently unavailable.",
      comparisons: [],
    };
  }
};

export const getAiToolComparisonDetail = async (
  comparisonId: string,
): Promise<AiToolComparisonDetailResult> => {
  try {
    const response = await fetch(
      `/ai-tools/comparisons/${encodeURIComponent(comparisonId)}`,
      {
        method: "GET",
        credentials: "same-origin",
      },
    );
    const payload = await parseJson<BackendAiToolComparisonDetailResponse>(response);

    if (response.status === 404 || payload?.kind === "ai_tool_comparison_not_found") {
      return {
        kind: "not_found",
        message: payload?.message ?? "Comparison detail was not found.",
      };
    }

    if (!response.ok || !payload || payload.kind !== "ai_tool_comparison_detail") {
      return {
        kind: "unavailable",
        message: "Comparison detail is currently unavailable.",
      };
    }

    return {
      kind: "detail",
      message:
        payload.message ??
        "Comparison detail is available in editorial form only.",
      comparison: payload.comparison,
    };
  } catch {
    return {
      kind: "unavailable",
      message: "Comparison detail is currently unavailable.",
    };
  }
};

export const getAiToolComparisonDetailBySlug = async (
  slug: string,
): Promise<AiToolComparisonDetailResult> => {
  const catalog = await getAiToolComparisonsCatalog();
  const match = catalog.comparisons.find((comparison) => comparison.slug === slug);

  if (!match) {
    return {
      kind: "not_found",
      message: "Comparison detail was not found.",
    };
  }

  return getAiToolComparisonDetail(match.comparisonId);
};
