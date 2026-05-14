import type { ExportJobRegistry } from "../registry/exportJobRegistry";
import type { RendererAdapter } from "../renderer/singleProcessRenderHarness";
import type { RenderOutputPathPolicy } from "../renderer/outputPathPolicy";
import {
  createRenderWorkerLoop,
  type RenderWorkerLoopController,
  type RenderWorkerLoopOptions,
} from "./renderWorker";

const getWorkerStartupEnabled = (): boolean =>
  process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP === "1";

export interface RenderWorkerStartupOptions extends RenderWorkerLoopOptions {
  workerId?: string;
}

export interface RenderWorkerStartupStatus {
  startupEnabled: boolean;
  workerId: string;
  pollIntervalMs: number;
  loopRunning: boolean;
}

export interface RenderWorkerStartupController {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  getStatus(): RenderWorkerStartupStatus;
}

export const createRenderWorkerStartup = (
  registry: ExportJobRegistry,
  rendererAdapter: RendererAdapter,
  pathPolicy: RenderOutputPathPolicy,
  options?: RenderWorkerStartupOptions,
): RenderWorkerStartupController => {
  const workerId = options?.workerId ?? `worker-startup-${Date.now()}`;
  const startupEnabled = getWorkerStartupEnabled();

  const loopController = createRenderWorkerLoop(
    registry,
    rendererAdapter,
    pathPolicy,
    {
      ...options,
      workerId,
    },
  );

  const getStatus = (): RenderWorkerStartupStatus => ({
    startupEnabled,
    workerId,
    pollIntervalMs: options?.pollIntervalMs ?? 2000,
    loopRunning: loopController.isRunning(),
  });

  return {
    start: () => {
      if (!startupEnabled) {
        return;
      }
      loopController.start();
    },
    stop: () => {
      loopController.stop();
    },
    isRunning: () => loopController.isRunning(),
    getStatus,
  };
};