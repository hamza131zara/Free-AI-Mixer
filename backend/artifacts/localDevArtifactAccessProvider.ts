import type {
  ArtifactAccessProvider,
  ArtifactAccessRequest,
} from "./artifactAccessProvider";
import type { InternalArtifactStorageRef } from "./internalArtifactStorageRef";
import type {
  BackendArtifactAccessReadyResponse,
  BackendArtifactAccessUnavailableResponse,
} from "../contracts/exportHttpTypes";

/**
 * Options for local dev artifact access provider.
 */
export interface LocalDevProviderOptions {
  /**
   * Lookup internal storage ref from job/artifact info.
   * Returns undefined if not found.
   */
  resolveArtifactStorageRef: (
    request: ArtifactAccessRequest,
  ) => InternalArtifactStorageRef | undefined;

  /**
   * Generate backend route URL for streaming.
   * Must return a safe backend route URL, not a file path.
   */
  streamUrlForArtifact: (
    request: ArtifactAccessRequest,
  ) => string;

  /**
   * Validate file path is within allowed root.
   */
  isPathWithinRoot: (
    ref: InternalArtifactStorageRef,
  ) => boolean;
}

/**
 * Checks if a URL is a safe backend route URL.
 * Rejects file://, Windows paths, path traversal, and absolute filesystem paths.
 */
const isSafeBackendRouteUrl = (url: string): boolean => {
  // Reject file:// URLs
  if (url.toLowerCase().startsWith("file:")) {
    return false;
  }

  // Reject Windows paths (e.g., C:\, D:\)
  if (/^[A-Za-z]:\\/.test(url)) {
    return false;
  }

  // Reject path traversal attempts
  if (url.includes("..")) {
    return false;
  }

  // Reject backslashes
  if (url.includes("\\")) {
    return false;
  }

  // Allow relative backend routes starting with /exports/
  if (url.startsWith("/exports/")) {
    return true;
  }

  // Reject any other absolute-like paths
  if (url.startsWith("/") && url.includes(":") && !url.startsWith("/exports/")) {
    return false;
  }

  // For any other URL, reject unless it's clearly a relative backend route
  return url.startsWith("/exports/");
};

/**
 * Creates a local dev artifact access provider.
 *
 * This provider returns local_dev_stream access when:
 * - Internal storage ref is found
 * - Path is within allowed root
 * - Stream URL is safe (backend route, not file path)
 *
 * IMPORTANT SAFETY RULES:
 * - Must never return filePath/rootPath/directoryPath in response
 * - Must validate streamUrlForArtifact returns safe backend route URL
 * - Must not import fs/path
 * - Must not import routes/registry/renderer
 * - Must not mutate job lifecycle
 * - Must not stream files
 */
export const createLocalDevArtifactAccessProvider = (
  options: LocalDevProviderOptions,
): ArtifactAccessProvider => ({
  async getArtifactAccess(
    request: ArtifactAccessRequest,
  ): Promise<BackendArtifactAccessReadyResponse | BackendArtifactAccessUnavailableResponse> {
    // Validate artifact metadata is provided
    if (!request.artifact) {
      return {
        kind: "artifact_access_unavailable",
        reason: "artifact_not_found",
        message: "Verified artifact metadata was not provided.",
      };
    }

    // Resolve internal storage ref
    const storageRef = options.resolveArtifactStorageRef(request);
    if (!storageRef) {
      return {
        kind: "artifact_access_unavailable",
        reason: "artifact_not_found",
        message: "Artifact storage reference was not found.",
      };
    }

    // Validate path is within allowed root
    if (!options.isPathWithinRoot(storageRef)) {
      return {
        kind: "artifact_access_unavailable",
        reason: "artifact_not_ready",
        message: "Artifact storage reference is outside the allowed root.",
      };
    }

    // Generate stream URL
    const streamUrl = options.streamUrlForArtifact(request);

    // Validate stream URL is safe
    if (!isSafeBackendRouteUrl(streamUrl)) {
      return {
        kind: "artifact_access_unavailable",
        reason: "artifact_not_ready",
        message: "Artifact stream URL is not safe.",
      };
    }

    // Return local_dev_stream access
    return {
      kind: "artifact_access_ready",
      artifact: request.artifact,
      access: {
        kind: "local_dev_stream",
        artifactId: request.artifactId,
        jobId: request.jobId,
        url: streamUrl,
        method: "GET",
        contentType: undefined,
        fileName: undefined,
        sizeBytes: request.artifact.sizeBytes,
      },
    };
  },
});