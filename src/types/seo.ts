export interface RouteSeoMetadata {
  title: string;
  description: string;
  canonicalPath: string;
  indexable: boolean;
  includeInSitemap: boolean;
  robots: "index,follow" | "noindex,nofollow";
}

export interface SitemapRouteEntry {
  path: string;
  title: string;
  description: string;
}
