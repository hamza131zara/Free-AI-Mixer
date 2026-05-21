import {
  getArtifactDownloadUiState,
  type ArtifactDownloadDescriptor,
} from "../services/artifactDownloadUiState";

export interface ArtifactDownloadActionProps {
  artifactId: string;
  descriptor?: ArtifactDownloadDescriptor;
  onRequestDownload?: (
    descriptor: Extract<ArtifactDownloadDescriptor, { kind: "ready" }>,
  ) => void;
}

export const ArtifactDownloadAction = ({
  artifactId,
  descriptor,
  onRequestDownload,
}: ArtifactDownloadActionProps) => {
  const uiState = getArtifactDownloadUiState(descriptor);
  const isReady = uiState.kind === "ready";

  return (
    <div
      data-testid={`artifact-download-action-${artifactId}`}
      className="mt-2 rounded-md border border-slate-200 p-2 text-sm"
    >
      <button
        type="button"
        disabled={!isReady}
        aria-disabled={!isReady}
        className="rounded-md border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => {
          if (uiState.kind === "ready") {
            onRequestDownload?.(uiState.descriptor);
          }
        }}
      >
        {uiState.label}
      </button>

      {uiState.kind === "disabled" ? (
        <p className="mt-1 text-xs text-slate-500">
          Artifact download is not available yet.
        </p>
      ) : (
        <p className="mt-1 text-xs text-slate-500">
          Backend-mediated artifact descriptor is ready.
        </p>
      )}
    </div>
  );
};
