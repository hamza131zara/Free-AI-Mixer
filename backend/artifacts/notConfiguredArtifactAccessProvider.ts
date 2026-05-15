import type {
  ArtifactAccessProvider,
  ArtifactAccessRequest,
} from "./artifactAccessProvider";
import type { BackendArtifactAccessUnavailableResponse } from "../contracts/exportHttpTypes";

/**
 * Creates a not-configured artifact access provider.
 *
 * This provider truthfully returns artifact_access_unavailable when called,
 * indicating that no storage provider has been configured yet.
 *
 * IMPORTANT SAFETY RULES:
 * - Never returns url
 * - Never returns access descriptor
 * - Never throws for normal requests
 * - Never inspects filesystem
 * - Never validates file existence
 * - Never mutates lifecycle/state
 * - Never calls renderer/runtime/harness
 * - Never imports routes
 */
export const createNotConfiguredArtifactAccessProvider = (): ArtifactAccessProvider => ({
  async getArtifactAccess(
    _request: ArtifactAccessRequest,
  ): Promise<BackendArtifactAccessUnavailableResponse> {
    return {
      kind: "artifact_access_unavailable",
      reason: "artifact_access_not_configured",
      message:
        "Artifact access is not configured. A storage provider must be configured before artifacts can be accessed.",
    };
  },
});