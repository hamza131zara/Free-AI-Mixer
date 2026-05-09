import {
  sceneGenerationAgent,
  type SceneGenerationAgentEvents,
  type SceneGenerationAgent,
} from "./sceneGenerationAgent";
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
        onPollingAttempt: () => {
          events.onProgress(job.id, 75);
        },
        onPollingPending: () => {
          events.onProgress(job.id, 80);
        },
        onPollingTransientFailure: () => {
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
        events.onProgress(job.id, 70);
      }

      const result = await this.generationAgent.resolveGeneration(
        outcome,
        signal,
        agentEvents,
      );

      events.onProgress(job.id, 90);
      events.onSuccess(job.id, result.scene, result.provider);
    } catch (error) {
      events.onError(job.id, error);
    }
  }
}

export const sceneQueueAgent = new DefaultSceneQueueAgent(sceneGenerationAgent, 2);
