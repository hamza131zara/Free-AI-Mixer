import { create } from "zustand";
import {
  getAiToolComparisonDetailBySlug,
  getAiToolComparisonsCatalog,
  getAiToolDetailBySlug,
  getAiToolsCatalog,
} from "../services/aiToolsService";
import type {
  AiToolCatalogEntry,
  AiToolComparisonCatalogEntry,
  AiToolComparisonDetail,
  AiToolDetail,
} from "../types/aiTools";

export interface AiToolsStoreState {
  catalogStatus: "unknown" | "ready" | "unavailable";
  catalogMessage: string;
  tools: AiToolCatalogEntry[];
  visibleTools: AiToolCatalogEntry[];
  selectedCategory: "all" | string;
  searchQuery: string;
  detailStatus: "idle" | "loading" | "ready" | "not_found" | "unavailable";
  detailMessage: string;
  selectedTool?: AiToolDetail;
  comparisonsStatus: "unknown" | "ready" | "unavailable";
  comparisonsMessage: string;
  comparisons: AiToolComparisonCatalogEntry[];
  visibleComparisons: AiToolComparisonCatalogEntry[];
  selectedComparisonCategory: "all" | string;
  comparisonSearchQuery: string;
  comparisonDetailStatus: "idle" | "loading" | "ready" | "not_found" | "unavailable";
  comparisonDetailMessage: string;
  selectedComparison?: AiToolComparisonDetail;
  pendingAction: "catalog" | "detail" | "comparisons" | "comparison_detail" | null;
  refreshCatalog: () => Promise<void>;
  refreshComparisons: () => Promise<void>;
  setSelectedCategory: (category: "all" | string) => void;
  setSearchQuery: (query: string) => void;
  setSelectedComparisonCategory: (category: "all" | string) => void;
  setComparisonSearchQuery: (query: string) => void;
  loadToolDetailBySlug: (slug: string) => Promise<void>;
  loadComparisonDetailBySlug: (slug: string) => Promise<void>;
}

const filterTools = (
  tools: AiToolCatalogEntry[],
  selectedCategory: "all" | string,
  searchQuery: string,
): AiToolCatalogEntry[] => {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return tools.filter((tool) => {
    const categoryMatch =
      selectedCategory === "all" || tool.categories.includes(selectedCategory);
    const queryMatch =
      normalizedQuery.length === 0 ||
      [
        tool.name,
        tool.companyOrProvider,
        tool.shortDescription,
        tool.categories.join(" "),
        tool.capabilities.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);

    return categoryMatch && queryMatch;
  });
};

const filterComparisons = (
  comparisons: AiToolComparisonCatalogEntry[],
  selectedCategory: "all" | string,
  searchQuery: string,
): AiToolComparisonCatalogEntry[] => {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return comparisons.filter((comparison) => {
    const categoryMatch =
      selectedCategory === "all" ||
      comparison.comparisonCategory === selectedCategory;
    const queryMatch =
      normalizedQuery.length === 0 ||
      [
        comparison.title,
        comparison.summary,
        comparison.toolsCompared.join(" "),
        comparison.comparisonCategory,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);

    return categoryMatch && queryMatch;
  });
};

export const useAiToolsStore = create<AiToolsStoreState>((set, get) => ({
  catalogStatus: "unknown",
  catalogMessage: "Loading AI tools editorial catalog.",
  tools: [],
  visibleTools: [],
  selectedCategory: "all",
  searchQuery: "",
  detailStatus: "idle",
  detailMessage: "Select an AI tool to review sources, caveats, and editorial notes.",
  selectedTool: undefined,
  comparisonsStatus: "unknown",
  comparisonsMessage: "Loading AI tools comparison catalog.",
  comparisons: [],
  visibleComparisons: [],
  selectedComparisonCategory: "all",
  comparisonSearchQuery: "",
  comparisonDetailStatus: "idle",
  comparisonDetailMessage:
    "Select a comparison to review caveats, source links, and editorial notes.",
  selectedComparison: undefined,
  pendingAction: null,
  refreshCatalog: async () => {
    set({ pendingAction: "catalog" });
    const result = await getAiToolsCatalog();
    const selectedCategory = get().selectedCategory;
    const searchQuery = get().searchQuery;

    set({
      catalogStatus: result.tools.length > 0 ? "ready" : "unavailable",
      catalogMessage: result.message,
      tools: result.tools,
      visibleTools: filterTools(result.tools, selectedCategory, searchQuery),
      pendingAction: null,
    });
  },
  refreshComparisons: async () => {
    set({ pendingAction: "comparisons" });
    const result = await getAiToolComparisonsCatalog();
    const selectedCategory = get().selectedComparisonCategory;
    const searchQuery = get().comparisonSearchQuery;

    set({
      comparisonsStatus: result.comparisons.length > 0 ? "ready" : "unavailable",
      comparisonsMessage: result.message,
      comparisons: result.comparisons,
      visibleComparisons: filterComparisons(
        result.comparisons,
        selectedCategory,
        searchQuery,
      ),
      pendingAction: null,
    });
  },
  setSelectedCategory: (category) => {
    const tools = get().tools;
    const searchQuery = get().searchQuery;
    set({
      selectedCategory: category,
      visibleTools: filterTools(tools, category, searchQuery),
    });
  },
  setSearchQuery: (query) => {
    const tools = get().tools;
    const selectedCategory = get().selectedCategory;
    set({
      searchQuery: query,
      visibleTools: filterTools(tools, selectedCategory, query),
    });
  },
  setSelectedComparisonCategory: (category) => {
    const comparisons = get().comparisons;
    const searchQuery = get().comparisonSearchQuery;
    set({
      selectedComparisonCategory: category,
      visibleComparisons: filterComparisons(comparisons, category, searchQuery),
    });
  },
  setComparisonSearchQuery: (query) => {
    const comparisons = get().comparisons;
    const selectedCategory = get().selectedComparisonCategory;
    set({
      comparisonSearchQuery: query,
      visibleComparisons: filterComparisons(comparisons, selectedCategory, query),
    });
  },
  loadToolDetailBySlug: async (slug) => {
    set({
      detailStatus: "loading",
      detailMessage: "Loading AI tool editorial detail.",
      pendingAction: "detail",
    });
    const result = await getAiToolDetailBySlug(slug);

    if (result.kind === "detail") {
      set({
        detailStatus: "ready",
        detailMessage: result.message,
        selectedTool: result.tool,
        pendingAction: null,
      });
      return;
    }

    set({
      detailStatus: result.kind === "not_found" ? "not_found" : "unavailable",
      detailMessage: result.message,
      selectedTool: undefined,
      pendingAction: null,
    });
  },
  loadComparisonDetailBySlug: async (slug) => {
    set({
      comparisonDetailStatus: "loading",
      comparisonDetailMessage: "Loading AI tools comparison detail.",
      pendingAction: "comparison_detail",
    });
    const result = await getAiToolComparisonDetailBySlug(slug);

    if (result.kind === "detail") {
      set({
        comparisonDetailStatus: "ready",
        comparisonDetailMessage: result.message,
        selectedComparison: result.comparison,
        pendingAction: null,
      });
      return;
    }

    set({
      comparisonDetailStatus:
        result.kind === "not_found" ? "not_found" : "unavailable",
      comparisonDetailMessage: result.message,
      selectedComparison: undefined,
      pendingAction: null,
    });
  },
}));
