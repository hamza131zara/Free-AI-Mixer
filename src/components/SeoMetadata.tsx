import { useEffect } from "react";
import type { AppRouteDefinition } from "../services/navigationService";
import { applyRouteSeoMetadata, applySeoMetadata } from "../services/seoMetadataService";
import type { RouteSeoMetadata } from "../types/seo";

export interface SeoMetadataProps {
  route?: AppRouteDefinition;
  metadata?: RouteSeoMetadata;
}

export function SeoMetadata({ route, metadata }: SeoMetadataProps) {
  useEffect(() => {
    if (metadata) {
      applySeoMetadata(metadata);
      return;
    }

    if (route) {
      applyRouteSeoMetadata(route);
    }
  }, [metadata, route]);

  return null;
}
