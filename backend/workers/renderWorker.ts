import type { ExportJobRegistry } from "../registry/exportJobRegistry";
import { executeRenderJob } from "../renderer/executeRenderJob";
import type { RendererAdapter, VerifiedArtifactRefPayload } from "../renderer/singleProcessRenderHarness";
import type { RenderOutputPathPolicy } from "../renderer/outputPathPolicy";
import type {
  BackendExportJobRecord,
  BackendExportLifecycleStatus,
} from "../contracts/exportHttpTypes";

const TERMINAL_STATUSES: BackendExportLifecycleStatus[] = [
  "success",
  "error",
  "expired",
];

export interface RenderWorkerOptions {
  workerId?: string;
  onVerifiedArtifactRef?: (payload: VerifiedArtifactRefPayload) => void;
}

export interface RenderWorkerDrainResult {
  workerId: string;
  attemptedJobIds: string[];
  acceptedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ jobId: string; code: string; message: string }>;
}

const isTerminalStatus = (status: BackendExportLifecycleStatus): boolean =>
  TERMINAL_STATUSES.includes(status);

export const drainRenderWorkerOnce = async (
  registry: ExportJobRegistry,
  rendererAdapter: RendererAdapter,
  pathPolicy: RenderOutputPathPolicy,
  options?: RenderWorkerOptions,
): Promise<RenderWorkerDrainResult> => {
  const workerId = options?.workerId ?? `worker-${Date.now()}`;

  const submittedJobs = registry.getByStatus("submitted");
  const attemptedJobIds: string[] = [];
  let acceptedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const errors: Array<{ jobId: string; code: string; message: string }> = [];

  for (const job of submittedJobs) {
    attemptedJobIds.push(job.jobId);

    if (isTerminalStatus(job.status)) {
      skippedCount += 1;
      continue;
    }

    const snapshotInput = buildSnapshotInput(job);

    try {
      const result = await executeRenderJob({
        registry,
        rendererAdapter,
        pathPolicy,
        workerId,
        jobId: job.jobId,
        snapshotInput,
        onVerifiedArtifactRef: options?.onVerifiedArtifactRef,
      });

      if (result.ok) {
        acceptedCount += 1;
      } else {
        failedCount += 1;
        errors.push({
          jobId: result.jobId,
          code: result.failure.code,
          message: result.failure.message,
        });
      }
    } catch (error) {
      failedCount += 1;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      errors.push({
        jobId: job.jobId,
        code: "worker_execution_error",
        message: errorMessage,
      });
    }
  }

  return {
    workerId,
    attemptedJobIds,
    acceptedCount,
    skippedCount,
    failedCount,
    errors: errors.map((e) => ({
      jobId: e.jobId,
      code: e.code,
      message: e.message,
    })),
  };
};

const getWorkerLoopEnabled = (): boolean =>
  process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP === "1";

const getWorkerPollInterval = (): number => {
  const envValue = process.env.FREE_AI_MIXER_WORKER_POLL_INTERVAL_MS;
  const parsed = parseInt(envValue ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 2000;
  }
  return parsed;
};

export interface RenderWorkerLoopOptions {
  workerId?: string;
  pollIntervalMs?: number;
  onVerifiedArtifactRef?: (payload: VerifiedArtifactRefPayload) => void;
}

export interface RenderWorkerLoopStatus {
  running: boolean;
  workerId: string;
  pollIntervalMs: number;
  enabledByEnv: boolean;
}

export interface RenderWorkerLoopController {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  getStatus(): RenderWorkerLoopStatus;
}

const buildSnapshotInput = (job: BackendExportJobRecord) => ({
  jobId: job.jobId,
  timelineId: job.timelineId,
  renderSettings: job.renderSettings,
  timelineSnapshot: {
    timelineId: job.timelineId,
    clips: [
      {
        clipId: `clip-${job.jobId}`,
        sceneRefId: "scene-0",
        startMs: 0,
        durationMs: 1000,
        order: 0,
      },
    ],
  },
  sceneRefs: [{ sceneId: "scene-0", role: "primary" }],
  mediaRefs: [],
  outputTarget: {
    jobFolderKey: job.jobId,
    artifactBaseName: "output",
    format: job.renderSettings.format,
  },
});

export const createRenderWorkerLoop = (
  registry: ExportJobRegistry,
  rendererAdapter: RendererAdapter,
  pathPolicy: RenderOutputPathPolicy,
  options?: RenderWorkerLoopOptions,
): RenderWorkerLoopController => {
  const workerId = options?.workerId ?? `worker-loop-${Date.now()}`;
  const pollIntervalMs = options?.pollIntervalMs ?? getWorkerPollInterval();
  const enabledByEnv = getWorkerLoopEnabled();

  let running = false;
  let intervalId: NodeJS.Timeout | null = null;
  let draining = false;

  const getStatus = (): RenderWorkerLoopStatus => ({
    running,
    workerId,
    pollIntervalMs,
    enabledByEnv,
  });

  const tick = async (): Promise<void> => {
    if (!running || draining) {
      return;
    }

    draining = true;
    try {
      await drainRenderWorkerOnce(registry, rendererAdapter, pathPolicy, { workerId, onVerifiedArtifactRef: options?.onVerifiedArtifactRef });
    } catch {
      // Contain errors - do not crash the loop
    } finally {
      draining = false;
    }
  };

  return {
    start: () => {
      if (!enabledByEnv) {
        return;
      }
      if (running && intervalId) {
        return;
      }
      running = true;
      intervalId = setInterval(tick, pollIntervalMs);
      // Run immediately on start
      tick();
    },
    stop: () => {
      running = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
    isRunning: () => running,
    getStatus,
  };
};