import type { RenderInputSnapshot } from "../contracts/renderInputSnapshot";

export interface RenderInputSnapshotStore {
  get(jobId: string): RenderInputSnapshot | undefined;
  set(jobId: string, snapshot: RenderInputSnapshot): void;
}

export const createInMemoryRenderInputSnapshotStore =
  (): RenderInputSnapshotStore => {
    const snapshots = new Map<string, RenderInputSnapshot>();

    return {
      get: (jobId) => snapshots.get(jobId),
      set: (jobId, snapshot) => {
        snapshots.set(jobId, snapshot);
      },
    };
  };
