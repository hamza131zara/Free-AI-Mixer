import type { SceneGenerationService } from "../services/sceneGenerationService";
import type {
  ProviderJobFailure,
  ProviderJobHandle,
  ProviderJobPollResult,
  ProviderJobTerminalResult,
} from "../types/providerJob";

export interface ScenePollingAgentOptions {
  timeoutMs?: number;
  maxTransientFailures?: number;
  pollDelayMs?: number;
}

export interface ScenePollingAgentEvents {
  onPollAttempt?: (handle: ProviderJobHandle, attempt: number) => void;
  onPollPending?: (handle: ProviderJobHandle, attempt: number) => void;
  onTransientFailure?: (
    handle: ProviderJobHandle,
    attempt: number,
    failure: ProviderJobFailure,
  ) => void;
}

export interface ScenePollingAgentResultSuccess {
  kind: "success";
  result: ProviderJobTerminalResult;
}

export interface ScenePollingAgentResultFailure {
  kind: "failure";
  failure: ProviderJobFailure;
}

export type ScenePollingAgentResult =
  | ScenePollingAgentResultSuccess
  | ScenePollingAgentResultFailure;

export interface ScenePollingAgent {
  pollUntilTerminal(
    service: SceneGenerationService,
    handle: ProviderJobHandle,
    signal?: AbortSignal,
    events?: ScenePollingAgentEvents,
  ): Promise<ScenePollingAgentResult>;
}

export class DefaultScenePollingAgent implements ScenePollingAgent {
  private readonly timeoutMs: number;
  private readonly maxTransientFailures: number;
  private readonly pollDelayMs: number;

  constructor(options: ScenePollingAgentOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxTransientFailures = options.maxTransientFailures ?? 2;
    this.pollDelayMs = options.pollDelayMs ?? 250;
  }

  async pollUntilTerminal(
    service: SceneGenerationService,
    handle: ProviderJobHandle,
    signal?: AbortSignal,
    events?: ScenePollingAgentEvents,
  ): Promise<ScenePollingAgentResult> {
    const startedAt = Date.now();
    let currentHandle = handle;
    let attempt = 0;
    let transientFailures = 0;

    while (true) {
      throwIfAborted(signal);

      if (Date.now() - startedAt > this.timeoutMs) {
        return {
          kind: "failure",
          failure: {
            kind: "failure",
            provider: currentHandle.provider,
            jobId: currentHandle.jobId,
            error: {
              message: "Scene generation polling timed out.",
              code: "provider_poll_timeout",
              details: {
                timeoutMs: this.timeoutMs,
              },
            },
            metadata: {
              provider: currentHandle.provider,
              pollAfterMs: this.pollDelayMs,
              attemptCount: attempt,
            },
          },
        };
      }

      attempt += 1;
      events?.onPollAttempt?.(currentHandle, attempt);

      const result = await service.pollGenerationJob(currentHandle, signal);

      if (result.kind === "success") {
        return result;
      }

      if (result.kind === "pending") {
        currentHandle = result.handle;
        events?.onPollPending?.(currentHandle, attempt);
        await waitForDelay(currentHandle.metadata?.pollAfterMs ?? this.pollDelayMs, signal);
        continue;
      }

      if (isTransientPollFailure(result, currentHandle) && transientFailures < this.maxTransientFailures) {
        transientFailures += 1;
        events?.onTransientFailure?.(currentHandle, attempt, result.failure);
        await waitForDelay(currentHandle.metadata?.pollAfterMs ?? this.pollDelayMs, signal);
        continue;
      }

      return result;
    }
  }
}

const transientPollFailureCodes = new Set([
  "http_error",
  "transport_exception",
]);

const isTransientPollFailure = (
  result: Extract<ProviderJobPollResult, { kind: "failure" }>,
  handle: ProviderJobHandle,
): boolean =>
  result.failure.provider === handle.provider &&
  transientPollFailureCodes.has(result.failure.error.code ?? "");

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
};

const waitForDelay = async (
  delayMs: number,
  signal?: AbortSignal,
): Promise<void> => {
  throwIfAborted(signal);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, delayMs);

    const abortHandler = (): void => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    const cleanup = (): void => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortHandler);
    };

    signal?.addEventListener("abort", abortHandler, { once: true });
  });
};

export const scenePollingAgent = new DefaultScenePollingAgent();
