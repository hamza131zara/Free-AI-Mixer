import type { ExportJobRegistry } from "../registry/exportJobRegistry";
import { executeRenderJob } from "../renderer/executeRenderJob";
import type { RendererAdapter } from "../renderer/singleProcessRenderHarness";
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