import type { ArtifactDownloadDescriptor } from "./artifactDownloadUiState";

export type ArtifactDownloadNavigationDecision =
  | {
      kind: "blocked";
      reason:
        | "no_descriptor"
        | "descriptor_unavailable"
        | "browser_navigation_disabled"
        | "descriptor_expired"
        | "unsupported_delivery_mode";
    }
  | {
      kind: "permitted";
      deliveryMode: "backend_mediated";
      jobId: string;
      artifactId: string;
      backendRoutePath: string;
      expiresAt: string;
    };

export interface ArtifactDownloadNavigationStrategyInput {
  descriptor?: ArtifactDownloadDescriptor;
  allowBrowserNavigation?: boolean;
  now?: Date;
}

export const isArtifactDownloadDescriptorExpired = (
  expiresAt: string,
  now: Date = new Date(),
): boolean => {
  const expiresAtMs = Date.parse(expiresAt);

  if (!Number.isFinite(expiresAtMs)) {
    return true;
  }

  return expiresAtMs <= now.getTime();
};

export const decideArtifactDownloadNavigation = ({
  descriptor,
  allowBrowserNavigation = false,
  now = new Date(),
}: ArtifactDownloadNavigationStrategyInput): ArtifactDownloadNavigationDecision => {
  if (!descriptor) {
    return {
      kind: "blocked",
      reason: "no_descriptor",
    };
  }

  if (descriptor.kind === "unavailable") {
    return {
      kind: "blocked",
      reason: "descriptor_unavailable",
    };
  }

  if (descriptor.deliveryMode !== "backend_mediated") {
    return {
      kind: "blocked",
      reason: "unsupported_delivery_mode",
    };
  }

  if (!allowBrowserNavigation) {
    return {
      kind: "blocked",
      reason: "browser_navigation_disabled",
    };
  }

  if (isArtifactDownloadDescriptorExpired(descriptor.expiresAt, now)) {
    return {
      kind: "blocked",
      reason: "descriptor_expired",
    };
  }

  return {
    kind: "permitted",
    deliveryMode: descriptor.deliveryMode,
    jobId: descriptor.jobId,
    artifactId: descriptor.artifactId,
    backendRoutePath: descriptor.backendRoutePath,
    expiresAt: descriptor.expiresAt,
  };
};
