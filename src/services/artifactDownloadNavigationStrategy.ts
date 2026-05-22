import type { ArtifactDownloadDescriptor } from "./artifactDownloadUiState";

export type ArtifactDownloadNavigationDecision =
  | {
      kind: "blocked";
      reason:
        | "no_descriptor"
        | "descriptor_unavailable"
        | "browser_navigation_disabled"
        | "descriptor_expired"
        | "unsupported_delivery_mode"
        | "invalid_navigation_target";
    }
  | {
      kind: "permitted";
      deliveryMode: "backend_mediated";
      jobId: string;
      artifactId: string;
      backendRoutePath: string;
      navigationUrl: string;
      expiresAt: string;
    }
  | {
      kind: "permitted";
      deliveryMode: "backend_signed_url";
      jobId: string;
      artifactId: string;
      signedUrl: string;
      navigationUrl: string;
      expiresAt: string;
    };

export interface ArtifactDownloadNavigationStrategyInput {
  descriptor?: ArtifactDownloadDescriptor;
  allowBrowserNavigation?: boolean;
  now?: Date;
}

export interface ArtifactDownloadWindowLike {
  open: (url: string, target?: string, features?: string) => unknown;
}

export interface NavigateToArtifactDownloadDescriptorInput
  extends ArtifactDownloadNavigationStrategyInput {
  windowRef?: ArtifactDownloadWindowLike;
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

const isSafeBackendRoutePath = (value: string): boolean =>
  value.startsWith("/exports/") &&
  !value.startsWith("//") &&
  !value.includes("..") &&
  !value.includes("\\") &&
  !value.includes("file:");

const isSafeBackendSignedUrl = (value: string): boolean => {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
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

  if (descriptor.deliveryMode === "backend_mediated") {
    if (!isSafeBackendRoutePath(descriptor.backendRoutePath)) {
      return {
        kind: "blocked",
        reason: "invalid_navigation_target",
      };
    }

    return {
      kind: "permitted",
      deliveryMode: descriptor.deliveryMode,
      jobId: descriptor.jobId,
      artifactId: descriptor.artifactId,
      backendRoutePath: descriptor.backendRoutePath,
      navigationUrl: descriptor.backendRoutePath,
      expiresAt: descriptor.expiresAt,
    };
  }

  if (descriptor.deliveryMode === "backend_signed_url") {
    if (!isSafeBackendSignedUrl(descriptor.signedUrl)) {
      return {
        kind: "blocked",
        reason: "invalid_navigation_target",
      };
    }

    return {
      kind: "permitted",
      deliveryMode: descriptor.deliveryMode,
      jobId: descriptor.jobId,
      artifactId: descriptor.artifactId,
      signedUrl: descriptor.signedUrl,
      navigationUrl: descriptor.signedUrl,
      expiresAt: descriptor.expiresAt,
    };
  }

  return {
    kind: "blocked",
    reason: "unsupported_delivery_mode",
  };
};

export const navigateToArtifactDownloadDescriptor = ({
  descriptor,
  allowBrowserNavigation = true,
  now = new Date(),
  windowRef,
}: NavigateToArtifactDownloadDescriptorInput): ArtifactDownloadNavigationDecision => {
  const decision = decideArtifactDownloadNavigation({
    descriptor,
    allowBrowserNavigation,
    now,
  });

  if (decision.kind === "blocked") {
    return decision;
  }

  const targetWindow =
    windowRef ?? (typeof window === "undefined" ? undefined : window);

  if (!targetWindow || typeof targetWindow.open !== "function") {
    return {
      kind: "blocked",
      reason: "browser_navigation_disabled",
    };
  }

  targetWindow.open(
    decision.navigationUrl,
    "_blank",
    "noopener,noreferrer",
  );

  return decision;
};
