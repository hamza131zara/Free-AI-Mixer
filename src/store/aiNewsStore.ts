import { create } from "zustand";
import {
  getAiNewsDetailBySlug,
  getAiNewsFeed,
} from "../services/aiNewsService";
import type { AiNewsFeedItem } from "../types/aiNews";

export interface AiNewsStoreState {
  feedStatus: "unknown" | "ready" | "unavailable";
  feedMessage: string;
  items: AiNewsFeedItem[];
  visibleItems: AiNewsFeedItem[];
  selectedCategory: "all" | string;
  searchQuery: string;
  detailStatus: "idle" | "loading" | "ready" | "not_found" | "unavailable";
  detailMessage: string;
  selectedItem?: AiNewsFeedItem;
  pendingAction: "feed" | "detail" | null;
  refreshFeed: () => Promise<void>;
  setSelectedCategory: (category: "all" | string) => void;
  setSearchQuery: (query: string) => void;
  loadDetailBySlug: (slug: string) => Promise<void>;
}

const filterItems = (
  items: AiNewsFeedItem[],
  selectedCategory: "all" | string,
  searchQuery: string,
): AiNewsFeedItem[] => {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    const categoryMatch =
      selectedCategory === "all" || item.category === selectedCategory;
    const queryMatch =
      normalizedQuery.length === 0 ||
      [item.title, item.summary, item.category, item.sourceName]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);

    return categoryMatch && queryMatch;
  });
};

export const useAiNewsStore = create<AiNewsStoreState>((set, get) => ({
  feedStatus: "unknown",
  feedMessage: "Loading AI news editorial shell.",
  items: [],
  visibleItems: [],
  selectedCategory: "all",
  searchQuery: "",
  detailStatus: "idle",
  detailMessage: "Select a news item to review source attribution and last-checked metadata.",
  selectedItem: undefined,
  pendingAction: null,
  refreshFeed: async () => {
    set({ pendingAction: "feed" });
    const result = await getAiNewsFeed();
    const selectedCategory = get().selectedCategory;
    const searchQuery = get().searchQuery;

    set({
      feedStatus: result.items.length > 0 ? "ready" : "unavailable",
      feedMessage: result.message,
      items: result.items,
      visibleItems: filterItems(result.items, selectedCategory, searchQuery),
      pendingAction: null,
    });
  },
  setSelectedCategory: (category) => {
    const items = get().items;
    const searchQuery = get().searchQuery;

    set({
      selectedCategory: category,
      visibleItems: filterItems(items, category, searchQuery),
    });
  },
  setSearchQuery: (query) => {
    const items = get().items;
    const selectedCategory = get().selectedCategory;

    set({
      searchQuery: query,
      visibleItems: filterItems(items, selectedCategory, query),
    });
  },
  loadDetailBySlug: async (slug) => {
    set({
      detailStatus: "loading",
      detailMessage: "Loading AI news editorial detail.",
      pendingAction: "detail",
    });
    const result = await getAiNewsDetailBySlug(slug);

    if (result.kind === "detail") {
      set({
        detailStatus: "ready",
        detailMessage: result.message,
        selectedItem: result.item,
        pendingAction: null,
      });
      return;
    }

    set({
      detailStatus: result.kind === "not_found" ? "not_found" : "unavailable",
      detailMessage: result.message,
      selectedItem: undefined,
      pendingAction: null,
    });
  },
}));
