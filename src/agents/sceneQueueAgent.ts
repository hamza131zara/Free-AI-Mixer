import {
  sceneGenerationAgent,
  type SceneGenerationAgentEvents,
  type SceneGenerationAgent,
} from "./sceneGenerationAgent";
import type {
  ProviderJobFailure,
  ProviderJobSubmission,
} from "../types/providerJob";
import type {
  GeneratedScene,
  SceneGenerationPayload,
  SceneProvider,
} from "../types/scene";

export interface SceneGenerationJob {
  id: string;
  payload: SceneGenerationPayload;
}

export interface SceneQueueAgentEvents {
  onQueued: (sceneId: string) => void;
  onGenerating: (sceneId: string) => void;
  onProgress: (sceneId: string, progress: number) => void;
  onProviderChange: (sceneId: string, provider: SceneProvider) => void;
  onProviderFallback: (
    sceneId: string,
    provider: SceneProvider,
    error: unknown,
  ) => void;
  onJobAccepted?: (
    sceneId: string,
    submission: ProviderJobSubmission,
  ) => void;
  onJobPolling?: (
    sceneId: string,
    submission: ProviderJobSubmission,
    attempt: number,
  ) => void;
  onJobPending?: (
    sceneId: string,
    submission: ProviderJobSubmission,
    attempt: number,
  ) => void;
  onJobTransientFailure?: (
    sceneId: string,
    submission: ProviderJobSubmission,
    attempt: number,
    failure: ProviderJobFailure["error"],
  ) => void;
  onSuccess: (
    sceneId: string,
    scene: GeneratedScene,
    provider: SceneProvider,
  ) => void;
  onError: (sceneId: string, error: unknown) => void;
}

export class DefaultSceneQueueAgent {
  constructor(
    private readonly generationAgent: SceneGenerationAgent,
    private readonly maxConcurrentJobs = 2,
  ) {}

  async generateAll(
    jobs: SceneGenerationJob[],
    events: SceneQueueAgentEvents,
    signal?: AbortSignal,
  ): Promise<void> {
    const deduplicatedJobs = jobs.filter(
      (job, index, collection) =>
        collection.findIndex((item) => item.id === job.id) === index,
    );
    const activeJobIds = new Set<string>();

    deduplicatedJobs.forEach((job) => {
      events.onQueued(job.id);
      events.onProgress(job.id, 0);
    });

    const pendingJobs = [...deduplicatedJobs];
    const runningJobs = new Set<Promise<void>>();

    const startNextJob = (): void => {
      if (signal?.aborted) {
        return;
      }

      const job = pendingJobs.shift();
      if (!job || activeJobIds.has(job.id)) {
        return;
      }

      activeJobIds.add(job.id);

      const runningJob = this.generateJob(job, events, signal).finally(() => {
        activeJobIds.delete(job.id);
        runningJobs.delete(runningJob);
      });

      runningJobs.add(runningJob);
    };

    while (runningJobs.size < this.maxConcurrentJobs && pendingJobs.length > 0) {
      startNextJob();
    }

    while (runningJobs.size > 0) {
      await Promise.race(runningJobs);

      while (
        !signal?.aborted &&
        runningJobs.size < this.maxConcurrentJobs &&
        pendingJobs.length > 0
      ) {
        startNextJob();
      }
    }
  }

  private async generateJob(
    job: SceneGenerationJob,
    events: SceneQueueAgentEvents,
    signal?: AbortSignal,
  ): Promise<void> {
    let finalized = false;
    const finalizeSuccess = (
      scene: GeneratedScene,
      provider: SceneProvider,
    ): void => {
      if (finalized) {
        return;
      }

      finalized = true;
      events.onProgress(job.id, 90);
      events.onSuccess(job.id, scene, provider);
    };
    const finalizeError = (error: unknown): void => {
      if (finalized) {
        return;
      }

      finalized = true;
      events.onError(job.id, error);
    };

    try {
      console.log("[Queue] Starting job:", job.id);
      events.onGenerating(job.id);
      events.onProgress(job.id, 20);

      const agentEvents: SceneGenerationAgentEvents = {
        onProviderStart: (provider) => {
          events.onProviderChange(job.id, provider);
          events.onProgress(job.id, 60);
        },
        onProviderFallback: (provider, error) => {
          events.onProviderFallback(job.id, provider, error);
          events.onProgress(job.id, 40);
        },
        onPollingAttempt: (_, attempt, submission) => {
          events.onJobPolling?.(job.id, submission, attempt);
          events.onProgress(job.id, 75);
        },
        onPollingPending: (_, attempt, submission) => {
          events.onJobPending?.(job.id, submission, attempt);
          events.onProgress(job.id, 80);
        },
        onPollingTransientFailure: (_, attempt, submission, error) => {
          events.onJobTransientFailure?.(job.id, submission, attempt, {
            message:
              error instanceof Error ? error.message : "Transient poll failure.",
            code:
              typeof error === "object" &&
              error !== null &&
              "code" in error &&
              typeof (error as { code?: unknown }).code === "string"
                ? (error as { code: string }).code
                : undefined,
            details:
              typeof error === "object" && error !== null
                ? error
                : undefined,
          });
          events.onProgress(job.id, 65);
        },
      };

      const outcome = await this.generationAgent.startGeneration(
        job.payload,
        signal,
        agentEvents,
      );

      if (outcome.kind === "submitted") {
        events.onProviderChange(job.id, outcome.handle.provider);
        events.onJobAccepted?.(job.id, outcome);
        events.onProgress(job.id, 70);
      }

      const result = await this.generationAgent.resolveGeneration(
        outcome,
        signal,
        agentEvents,
      );

      finalizeSuccess(result.scene, result.provider);
    } catch (error) {
      finalizeError(error);
    }
  }
}

export const sceneQueueAgent = new DefaultSceneQueueAgent(sceneGenerationAgent, 2);
