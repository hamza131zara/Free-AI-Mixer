import type { ExportJobRegistry } from "../registry/exportJobRegistry";
import type { RendererAdapter, VerifiedArtifactRefPayload } from "../renderer/singleProcessRenderHarness";
import type { RenderOutputPathPolicy } from "../renderer/outputPathPolicy";
import type { RenderInputSnapshotStore } from "../renderer/renderInputSnapshotStore";
import { createRenderWorkerStartup, type RenderWorkerStartupController } from "./renderWorkerStartup";

export interface RenderWorkerLifecycleStatus {
  initialized: boolean;
  running: boolean;
  startupStatus: {
    startupEnabled: boolean;
    workerId: string;
    pollIntervalMs: number;
    loopRunning: boolean;
  };
}

export interface RenderWorkerLifecycleController {
  init(): void;
  shutdown(): void;
  isRunning(): boolean;
  getStatus(): RenderWorkerLifecycleStatus;
}

export const createRenderWorkerLifecycle = (
  registry: ExportJobRegistry,
  rendererAdapter: RendererAdapter,
  pathPolicy: RenderOutputPathPolicy,
  onVerifiedArtifactRef?: (payload: VerifiedArtifactRefPayload) => void,
  snapshotStore?: RenderInputSnapshotStore,
): RenderWorkerLifecycleController => {
  const startupController = createRenderWorkerStartup(
    registry,
    rendererAdapter,
    pathPolicy,
    { onVerifiedArtifactRef, snapshotStore },
  );

  let initialized = false;

  const getStatus = (): RenderWorkerLifecycleStatus => ({
    initialized,
    running: startupController.isRunning(),
    startupStatus: startupController.getStatus(),
  });

  return {
    init: () => {
      if (initialized) {
        return;
      }
      startupController.start();
      initialized = true;
    },
    shutdown: () => {
      startupController.stop();
      initialized = false;
    },
    isRunning: () => startupController.isRunning(),
    getStatus,
  };
};
