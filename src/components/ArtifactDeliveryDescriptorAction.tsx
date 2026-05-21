import { ArtifactDownloadAction } from "./ArtifactDownloadAction";
import type { ArtifactDownloadDescriptor } from "../services/artifactDownloadUiState";
import {
  buildArtifactDeliveryDescriptorStoreKey,
  useArtifactDeliveryDescriptorStore,
  type ArtifactDeliveryDescriptorStoreEntry,
} from "../store/artifactDeliveryDescriptorStore";

export interface ArtifactDeliveryDescriptorActionProps {
  jobId: string;
  artifactId: string;
  onRequestDownload?: (
    descriptor: Extract<ArtifactDownloadDescriptor, { kind: "ready" }>,
  ) => void;
}

export const mapDescriptorStoreEntryToDownloadDescriptor = (
  entry: ArtifactDeliveryDescriptorStoreEntry,
): ArtifactDownloadDescriptor | undefined => {
  if (entry.kind === "ready") {
    return {
      kind: "ready",
      deliveryMode: entry.deliveryMode,
      jobId: entry.jobId,
      artifactId: entry.artifactId,
      backendRoutePath: entry.backendRoutePath,
      expiresAt: entry.expiresAt,
    };
  }

  if (entry.kind === "unavailable") {
    return {
      kind: "unavailable",
      reason: entry.reason,
    };
  }

  return undefined;
};

export const ArtifactDeliveryDescriptorAction = ({
  jobId,
  artifactId,
  onRequestDownload,
}: ArtifactDeliveryDescriptorActionProps) => {
  const descriptorKey = buildArtifactDeliveryDescriptorStoreKey(jobId, artifactId);

  const descriptorState = useArtifactDeliveryDescriptorStore(
    (state) =>
      state.descriptorsByKey[descriptorKey] ?? {
        kind: "idle",
      },
  );

  const requestArtifactDeliveryDescriptor = useArtifactDeliveryDescriptorStore(
    (state) => state.requestArtifactDeliveryDescriptor,
  );

  const downloadDescriptor =
    mapDescriptorStoreEntryToDownloadDescriptor(descriptorState);

  return (
    <div
      data-testid={`artifact-delivery-descriptor-action-${artifactId}`}
      className="mt-2 rounded-md border border-slate-200 p-2 text-sm"
    >
      <button
        type="button"
        className="rounded-md border px-3 py-1"
        onClick={() => {
          void requestArtifactDeliveryDescriptor(jobId, artifactId);
        }}
      >
        Check delivery descriptor
      </button>

      {descriptorState.kind === "loading" ? (
        <p className="mt-1 text-xs text-slate-500">
          Checking artifact delivery descriptor...
        </p>
      ) : null}

      {descriptorState.kind === "error" ? (
        <p className="mt-1 text-xs text-slate-500">
          Artifact delivery descriptor is not available.
        </p>
      ) : null}

      <ArtifactDownloadAction
        artifactId={artifactId}
        descriptor={downloadDescriptor}
        onRequestDownload={onRequestDownload}
      />
    </div>
  );
};
