import { create } from "zustand";
import {
  getCardTemplateDetailBySlug,
  getCardsCatalog,
} from "../services/cardCatalogService";
import type {
  CardCategory,
  CardPreviewState,
  CardTemplateCatalogEntry,
  CardTemplateDetail,
} from "../types/cards";

export interface CardCatalogStoreState {
  catalogStatus: "unknown" | "ready" | "unavailable";
  catalogMessage: string;
  templates: CardTemplateCatalogEntry[];
  visibleTemplates: CardTemplateCatalogEntry[];
  selectedCategory: "all" | CardCategory;
  searchQuery: string;
  detailStatus: "idle" | "loading" | "ready" | "not_found" | "unavailable";
  detailMessage: string;
  selectedTemplate?: CardTemplateDetail;
  previewState?: CardPreviewState;
  pendingAction: "catalog" | "detail" | null;
  refreshCatalog: () => Promise<void>;
  setSelectedCategory: (category: "all" | CardCategory) => void;
  setSearchQuery: (query: string) => void;
  loadTemplateBySlug: (slug: string) => Promise<void>;
  updatePreviewField: (fieldId: string, value: string) => void;
}

const filterTemplates = (
  templates: CardTemplateCatalogEntry[],
  selectedCategory: "all" | CardCategory,
  searchQuery: string,
): CardTemplateCatalogEntry[] => {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return templates.filter((template) => {
    const categoryMatch =
      selectedCategory === "all" || template.category === selectedCategory;
    const queryMatch =
      normalizedQuery.length === 0 ||
      [
        template.title,
        template.category,
        template.occasion,
        template.description,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);

    return categoryMatch && queryMatch;
  });
};

const createInitialPreviewState = (template: CardTemplateDetail): CardPreviewState => ({
  templateId: template.cardTemplateId,
  fieldValues: Object.fromEntries(
    template.supportedFields.map((field) => [
      field.fieldId,
      field.placeholder ?? field.options?.[0]?.value ?? "",
    ]),
  ),
});

export const useCardCatalogStore = create<CardCatalogStoreState>((set, get) => ({
  catalogStatus: "unknown",
  catalogMessage: "Loading card template catalog.",
  templates: [],
  visibleTemplates: [],
  selectedCategory: "all",
  searchQuery: "",
  detailStatus: "idle",
  detailMessage:
    "Select a card template to preview local editable fields and the static card layout shell.",
  selectedTemplate: undefined,
  previewState: undefined,
  pendingAction: null,
  refreshCatalog: async () => {
    set({ pendingAction: "catalog" });
    const result = await getCardsCatalog();
    const selectedCategory = get().selectedCategory;
    const searchQuery = get().searchQuery;

    set({
      catalogStatus: result.templates.length > 0 ? "ready" : "unavailable",
      catalogMessage: result.message,
      templates: result.templates,
      visibleTemplates: filterTemplates(
        result.templates,
        selectedCategory,
        searchQuery,
      ),
      pendingAction: null,
    });
  },
  setSelectedCategory: (category) => {
    const templates = get().templates;
    const searchQuery = get().searchQuery;

    set({
      selectedCategory: category,
      visibleTemplates: filterTemplates(templates, category, searchQuery),
    });
  },
  setSearchQuery: (query) => {
    const templates = get().templates;
    const selectedCategory = get().selectedCategory;

    set({
      searchQuery: query,
      visibleTemplates: filterTemplates(templates, selectedCategory, query),
    });
  },
  loadTemplateBySlug: async (slug) => {
    set({
      detailStatus: "loading",
      detailMessage: "Loading card template detail.",
      pendingAction: "detail",
    });
    const result = await getCardTemplateDetailBySlug(slug);

    if (result.kind === "detail") {
      set({
        detailStatus: "ready",
        detailMessage: result.message,
        selectedTemplate: result.template,
        previewState: createInitialPreviewState(result.template),
        pendingAction: null,
      });
      return;
    }

    set({
      detailStatus: result.kind === "not_found" ? "not_found" : "unavailable",
      detailMessage: result.message,
      selectedTemplate: undefined,
      previewState: undefined,
      pendingAction: null,
    });
  },
  updatePreviewField: (fieldId, value) => {
    const previewState = get().previewState;

    if (!previewState) {
      return;
    }

    set({
      previewState: {
        ...previewState,
        fieldValues: {
          ...previewState.fieldValues,
          [fieldId]: value,
        },
      },
    });
  },
}));
