import { create } from "zustand";
import {
  getArtifactDeliveryDescriptor,
  type ArtifactDeliveryDescriptorServiceOptions,
  type ArtifactDeliveryDescriptorServiceResult,
} from "../services/artifactDeliveryDescriptorService";

export type ArtifactDeliveryDescriptorStoreEntry =
  | {
      kind: "idle";
    }
  | {
      kind: "loading";
      jobId: string;
      artifactId: string;
    }
  | {
      kind: "unavailable";
      jobId: string;
      artifactId: string;
      reason: Extract<ArtifactDeliveryDescriptorServiceResult, { kind: "unavailable" }>["reason"];
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
      kind: "error";
      jobId: string;
      artifactId: string;
      reason: Extract<ArtifactDeliveryDescriptorServiceResult, { kind: "error" }>["reason"];
      status?: number;
    };

export interface RequestArtifactDeliveryDescriptorOptions
  extends ArtifactDeliveryDescriptorServiceOptions {}

export interface ArtifactDeliveryDescriptorStoreState {
  descriptorsByKey: Record<string, ArtifactDeliveryDescriptorStoreEntry>;
  requestSequenceByKey: Record<string, number>;
  getDescriptorState: (
    jobId: string,
    artifactId: string,
  ) => ArtifactDeliveryDescriptorStoreEntry;
  requestArtifactDeliveryDescriptor: (
    jobId: string,
    artifactId: string,
    options?: RequestArtifactDeliveryDescriptorOptions,
  ) => Promise<ArtifactDeliveryDescriptorStoreEntry>;
  clearArtifactDeliveryDescriptor: (jobId: string, artifactId: string) => void;
  resetArtifactDeliveryDescriptors: () => void;
}

export const buildArtifactDeliveryDescriptorStoreKey = (
  jobId: string,
  artifactId: string,
): string => `${jobId}::${artifactId}`;

const mapServiceResultToStoreEntry = (
  jobId: string,
  artifactId: string,
  result: ArtifactDeliveryDescriptorServiceResult,
): ArtifactDeliveryDescriptorStoreEntry => {
  if (result.kind === "unavailable") {
    return {
      kind: "unavailable",
      jobId,
      artifactId,
      reason: result.reason,
    };
  }

  if (result.kind === "ready") {
    return {
      kind: "ready",
      deliveryMode: result.deliveryMode,
      jobId: result.jobId,
      artifactId: result.artifactId,
      backendRoutePath: result.backendRoutePath,
      expiresAt: result.expiresAt,
    };
  }

  const errorEntry: ArtifactDeliveryDescriptorStoreEntry = {
    kind: "error",
    jobId,
    artifactId,
    reason: result.reason,
  };

  return result.status === undefined
    ? errorEntry
    : {
        ...errorEntry,
        status: result.status,
      };
};

export const useArtifactDeliveryDescriptorStore =
  create<ArtifactDeliveryDescriptorStoreState>((set, get) => ({
    descriptorsByKey: {},
    requestSequenceByKey: {},

    getDescriptorState: (jobId, artifactId) =>
      get().descriptorsByKey[
        buildArtifactDeliveryDescriptorStoreKey(jobId, artifactId)
      ] ?? {
        kind: "idle",
      },

    requestArtifactDeliveryDescriptor: async (jobId, artifactId, options = {}) => {
      const key = buildArtifactDeliveryDescriptorStoreKey(jobId, artifactId);
      const requestSequence = (get().requestSequenceByKey[key] ?? 0) + 1;

      set((state) => ({
        descriptorsByKey: {
          ...state.descriptorsByKey,
          [key]: {
            kind: "loading",
            jobId,
            artifactId,
          },
        },
        requestSequenceByKey: {
          ...state.requestSequenceByKey,
          [key]: requestSequence,
        },
      }));

      const result = await getArtifactDeliveryDescriptor(jobId, artifactId, options);
      const nextEntry = mapServiceResultToStoreEntry(jobId, artifactId, result);

      set((state) => {
        if (state.requestSequenceByKey[key] !== requestSequence) {
          return state;
        }

        return {
          descriptorsByKey: {
            ...state.descriptorsByKey,
            [key]: nextEntry,
          },
          requestSequenceByKey: state.requestSequenceByKey,
        };
      });

      return nextEntry;
    },

    clearArtifactDeliveryDescriptor: (jobId, artifactId) => {
      const key = buildArtifactDeliveryDescriptorStoreKey(jobId, artifactId);

      set((state) => {
        const { [key]: _descriptor, ...descriptorsByKey } = state.descriptorsByKey;
        const { [key]: _sequence, ...requestSequenceByKey } = state.requestSequenceByKey;

        return {
          descriptorsByKey,
          requestSequenceByKey,
        };
      });
    },

    resetArtifactDeliveryDescriptors: () => {
      set({
        descriptorsByKey: {},
        requestSequenceByKey: {},
      });
    },
  }));
