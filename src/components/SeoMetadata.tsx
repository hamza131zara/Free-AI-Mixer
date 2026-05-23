import { useEffect } from "react";
import type { AppRouteDefinition } from "../services/navigationService";
import { applyRouteSeoMetadata } from "../services/seoMetadataService";

export interface SeoMetadataProps {
  route: AppRouteDefinition;
}

export function SeoMetadata({ route }: SeoMetadataProps) {
  useEffect(() => {
    applyRouteSeoMetadata(route);
  }, [route]);

  return null;
}
