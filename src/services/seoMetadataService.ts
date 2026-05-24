import { appRoutes, type AppRouteDefinition } from "./navigationService";
import type { RouteSeoMetadata, SitemapRouteEntry } from "../types/seo";

const ensureMetaElement = (name: string): HTMLMetaElement => {
  let element = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }

  return element;
};

const ensureCanonicalElement = (): HTMLLinkElement => {
  let element = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  return element;
};

export const resolveCanonicalUrl = (
  canonicalPath: string,
  origin: string,
): string => new URL(canonicalPath, origin).toString();

export const getRouteSeoMetadata = (
  route: AppRouteDefinition,
): RouteSeoMetadata => route.seo;

export const applySeoMetadata = (metadata: RouteSeoMetadata): void => {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  document.title = metadata.title;
  ensureMetaElement("description").setAttribute("content", metadata.description);
  ensureMetaElement("robots").setAttribute("content", metadata.robots);
  ensureCanonicalElement().setAttribute(
    "href",
    resolveCanonicalUrl(metadata.canonicalPath, window.location.origin),
  );
};

export const applyRouteSeoMetadata = (
  route: AppRouteDefinition,
): void => {
  applySeoMetadata(getRouteSeoMetadata(route));
};

export const buildPublicSitemapInventory = (): SitemapRouteEntry[] =>
  appRoutes
    .filter((route) => route.seo.indexable && route.seo.includeInSitemap)
    .map((route) => ({
      path: route.path,
      title: route.seo.title,
      description: route.seo.description,
    }));
