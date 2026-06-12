export type BackendVideoGenerationLifecycleState =
  | "submitted"
  | "queued"
  | "running"
  | "processing"
  | "finalizing"
  | "metadata_ready"
  | "failed"
  | "cancelled"
  | "expired";

export type BackendVideoGenerationTerminalState =
  | "metadata_ready"
  | "failed"
  | "cancelled"
  | "expired";

export interface BackendVideoGenerationLifecycleSnapshot {
  jobId: string;
  state: BackendVideoGenerationLifecycleState;
  updatedAt: string;
  providerId?: BackendVideoProviderIdForLifecycle;
}

export type BackendVideoProviderIdForLifecycle =
  | "veo"
  | "runway"
  | "pika"
  | "gemini_video"
  | "mock_local";

export interface BackendVideoLifecycleArtifactReadiness {
  verifiedArtifactMetadataReady: boolean;
}

export const backendVideoGenerationLifecycleStates: readonly BackendVideoGenerationLifecycleState[] =
  [
    "submitted",
    "queued",
    "running",
    "processing",
    "finalizing",
    "metadata_ready",
    "failed",
    "cancelled",
    "expired",
  ] as const;

const terminalStates = new Set<BackendVideoGenerationLifecycleState>([
  "metadata_ready",
  "failed",
  "cancelled",
  "expired",
]);

export const isBackendVideoGenerationTerminalState = (
  state: BackendVideoGenerationLifecycleState,
): state is BackendVideoGenerationTerminalState => terminalStates.has(state);

export const canEnterBackendVideoMetadataReady = ({
  verifiedArtifactMetadataReady,
}: BackendVideoLifecycleArtifactReadiness): boolean =>
  verifiedArtifactMetadataReady === true;

export const resolveBackendVideoLifecycleState = ({
  requestedState,
  verifiedArtifactMetadataReady,
}: BackendVideoLifecycleArtifactReadiness & {
  requestedState: BackendVideoGenerationLifecycleState;
}): BackendVideoGenerationLifecycleState => {
  if (
    requestedState === "metadata_ready" &&
    !canEnterBackendVideoMetadataReady({ verifiedArtifactMetadataReady })
  ) {
    return "failed";
  }

  return requestedState;
};
