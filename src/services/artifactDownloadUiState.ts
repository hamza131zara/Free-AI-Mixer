import type { ArtifactDeliveryUnavailableReason } from "./artifactDeliveryDescriptorService";

export type ArtifactDownloadDescriptor =
  | {
      kind: "unavailable";
      reason: ArtifactDeliveryUnavailableReason;
    }
  | {
      kind: "ready";
      deliveryMode: "backend_mediated";
      jobId: string;
      artifactId: string;
      backendRoutePath: string;
      expiresAt: string;
    }
  | {
      kind: "ready";
      deliveryMode: "backend_signed_url";
      jobId: string;
      artifactId: string;
      signedUrl: string;
      expiresAt: string;
    };

export type ArtifactDownloadUiState =
  | {
      kind: "disabled";
      label: string;
    }
  | {
      kind: "ready";
      label: string;
      descriptor: Extract<ArtifactDownloadDescriptor, { kind: "ready" }>;
    };

export const getArtifactDownloadUiState = (
  descriptor?: ArtifactDownloadDescriptor,
): ArtifactDownloadUiState => {
  if (!descriptor || descriptor.kind === "unavailable") {
    return {
      kind: "disabled",
      label: "Download unavailable",
    };
  }

  return {
    kind: "ready",
    label: "Download artifact",
    descriptor,
  };
};
