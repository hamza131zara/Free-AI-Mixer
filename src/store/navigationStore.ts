import { create } from "zustand";
import {
  appRoutes,
  getRouteByPath,
  normalizeAppPath,
  type AppRouteDefinition,
} from "../services/navigationService";

export interface NavigationStoreState {
  currentPath: string;
  mobileMenuOpen: boolean;
  navigateTo: (path: string) => void;
  syncWithLocation: (pathname: string) => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
}

export const useNavigationStore = create<NavigationStoreState>((set) => ({
  currentPath:
    typeof window === "undefined" ? "/" : normalizeAppPath(window.location.pathname),
  mobileMenuOpen: false,
  navigateTo: (path) => {
    const normalizedPath = normalizeAppPath(path);

    if (typeof window !== "undefined" && window.location.pathname !== normalizedPath) {
      window.history.pushState({}, "", normalizedPath);
      window.scrollTo({ top: 0, behavior: "auto" });
    }

    set({
      currentPath: normalizedPath,
      mobileMenuOpen: false,
    });
  },
  syncWithLocation: (pathname) => {
    set({
      currentPath: normalizeAppPath(pathname),
      mobileMenuOpen: false,
    });
  },
  toggleMobileMenu: () => {
    set((state) => ({
      mobileMenuOpen: !state.mobileMenuOpen,
    }));
  },
  closeMobileMenu: () => {
    set({ mobileMenuOpen: false });
  },
}));

export const initializeNavigationStore = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  const syncCurrentLocation = (): void => {
    useNavigationStore.getState().syncWithLocation(window.location.pathname);
  };

  syncCurrentLocation();
  window.addEventListener("popstate", syncCurrentLocation);
};

export const selectCurrentRoute = (state: NavigationStoreState): AppRouteDefinition =>
  getRouteByPath(state.currentPath);

export const selectNavigationItems = (): AppRouteDefinition[] => appRoutes;
