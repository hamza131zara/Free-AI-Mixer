import { create } from "zustand";
import {
  getTemplateCatalog,
  getTemplateDetail,
} from "../services/templateCatalogService";
import type {
  TemplateCatalogEntry,
  TemplateCategory,
  TemplateDetail,
} from "../types/templates";

export interface TemplateCatalogStoreState {
  catalogStatus: "unknown" | "ready" | "unavailable";
  catalogMessage: string;
  templates: TemplateCatalogEntry[];
  visibleTemplates: TemplateCatalogEntry[];
  selectedCategory: "all" | TemplateCategory;
  searchQuery: string;
  selectedTemplateId?: string;
  detailStatus: "idle" | "loading" | "ready" | "not_found" | "unavailable";
  detailMessage: string;
  selectedTemplate?: TemplateDetail;
  pendingAction: "refresh" | "detail" | null;
  refreshCatalog: () => Promise<void>;
  setSelectedCategory: (category: "all" | TemplateCategory) => void;
  setSearchQuery: (query: string) => void;
  selectTemplate: (templateId: string) => Promise<void>;
}

const unknownCatalogMessage = "Loading template gallery metadata.";

const applyFilters = (
  templates: TemplateCatalogEntry[],
  selectedCategory: "all" | TemplateCategory,
  searchQuery: string,
): TemplateCatalogEntry[] => {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return templates.filter((template) => {
    const categoryMatch =
      selectedCategory === "all" || template.category === selectedCategory;
    const queryMatch =
      normalizedQuery.length === 0 ||
      [
        template.title,
        template.description,
        template.useCase,
        template.category,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);

    return categoryMatch && queryMatch;
  });
};

export const useTemplateCatalogStore = create<TemplateCatalogStoreState>((set, get) => ({
  catalogStatus: "unknown",
  catalogMessage: unknownCatalogMessage,
  templates: [],
  visibleTemplates: [],
  selectedCategory: "all",
  searchQuery: "",
  selectedTemplateId: undefined,
  detailStatus: "idle",
  detailMessage: "Select a template to review its planning details.",
  selectedTemplate: undefined,
  pendingAction: null,
  refreshCatalog: async () => {
    set({ pendingAction: "refresh" });
    const result = await getTemplateCatalog();
    const selectedCategory = get().selectedCategory;
    const searchQuery = get().searchQuery;

    set({
      catalogStatus: result.templates.length > 0 ? "ready" : "unavailable",
      catalogMessage: result.message,
      templates: result.templates,
      visibleTemplates: applyFilters(result.templates, selectedCategory, searchQuery),
      pendingAction: null,
    });
  },
  setSelectedCategory: (category) => {
    const templates = get().templates;
    const searchQuery = get().searchQuery;

    set({
      selectedCategory: category,
      visibleTemplates: applyFilters(templates, category, searchQuery),
    });
  },
  setSearchQuery: (query) => {
    const templates = get().templates;
    const selectedCategory = get().selectedCategory;

    set({
      searchQuery: query,
      visibleTemplates: applyFilters(templates, selectedCategory, query),
    });
  },
  selectTemplate: async (templateId) => {
    set({
      selectedTemplateId: templateId,
      detailStatus: "loading",
      detailMessage: "Loading template planning details.",
      pendingAction: "detail",
    });

    const result = await getTemplateDetail(templateId);

    if (result.kind === "detail") {
      set({
        detailStatus: "ready",
        detailMessage: result.message,
        selectedTemplate: result.template,
        pendingAction: null,
      });
      return;
    }

    if (result.kind === "not_found") {
      set({
        detailStatus: "not_found",
        detailMessage: result.message,
        selectedTemplate: undefined,
        pendingAction: null,
      });
      return;
    }

    set({
      detailStatus: "unavailable",
      detailMessage: result.message,
      selectedTemplate: undefined,
      pendingAction: null,
    });
  },
}));
