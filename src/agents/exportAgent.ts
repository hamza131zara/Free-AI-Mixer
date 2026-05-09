import {
  pollExportJob,
  submitExportJob,
  type ExportServiceRequestOptions,
} from "../services/exportService";
import type {
  ExportFailure,
  ExportJobHandle,
  ExportPollResult,
  ExportSubmissionResult,
  ExportTerminalResult,
  TimelineExportRequest,
} from "../types/exportJob";

// Phase 5.3A scaffold only.
// This agent is not wired into app runtime/store/UI yet.
// No backend render queue/workers/webhooks are implemented here.
// No fake completion, progress, artifacts, or cancellation behavior is allowed.

export interface ExportAgentStartFailure {
  kind: "failure";
  failure: ExportFailure;
}

export interface ExportAgentStartAccepted {
  kind: "accepted_job";
  handle: ExportJobHandle;
}

export interface ExportAgentStartSuccess {
  kind: "success";
  result: ExportTerminalResult;
}

export type ExportAgentStartResult =
  | ExportAgentStartFailure
  | ExportAgentStartAccepted
  | ExportAgentStartSuccess;

export interface ExportAgentTerminalFailure {
  kind: "failure";
  failure: ExportFailure;
  jobId?: string;
}

export interface ExportAgentTerminalSuccess {
  kind: "success";
  result: ExportTerminalResult;
}

export type ExportAgentTerminalResult =
  | ExportAgentTerminalFailure
  | ExportAgentTerminalSuccess;

export interface ExportAgentEvents {
  onPollAttempt?: (handle: ExportJobHandle, attempt: number) => void;
  onPollPending?: (handle: ExportJobHandle, attempt: number) => void;
  onTransientPollFailure?: (
    handle: ExportJobHandle,
    attempt: number,
    failure: ExportFailure,
  ) => void;
}

export interface ExportAgentPollOptions {
  timeoutMs?: number;
  maxTransientFailures?: number;
  pollDelayMs?: number;
}

export interface ExportAgentRequestOptions {
  signal?: AbortSignal;
}

export interface ExportAgent {
  startExport(
    request: TimelineExportRequest,
    options?: ExportAgentRequestOptions,
  ): Promise<ExportAgentStartResult>;
  resolveExport(
    submission: ExportSubmissionResult,
    options?: ExportAgentRequestOptions & ExportAgentPollOptions,
    events?: ExportAgentEvents,
  ): Promise<ExportAgentTerminalResult>;
  pollExportUntilTerminal(
    handle: ExportJobHandle,
    options?: ExportAgentRequestOptions & ExportAgentPollOptions,
    events?: ExportAgentEvents,
  ): Promise<ExportAgentTerminalResult>;
}

export class DefaultExportAgent implements ExportAgent {
  private readonly defaultTimeoutMs: number;
  private readonly defaultMaxTransientFailures: number;
  private readonly defaultPollDelayMs: number;

  constructor(options: ExportAgentPollOptions = {}) {
    this.defaultTimeoutMs = options.timeoutMs ?? 60_000;
    this.defaultMaxTransientFailures = options.maxTransientFailures ?? 2;
    this.defaultPollDelayMs = options.pollDelayMs ?? 1_000;
  }

  async startExport(
    request: TimelineExportRequest,
    options?: ExportAgentRequestOptions,
  ): Promise<ExportAgentStartResult> {
    const submission = await submitExportJob(request, toServiceOptions(options));
    return this.toStartResult(submission);
  }

  async resolveExport(
    submission: ExportSubmissionResult,
    options?: ExportAgentRequestOptions & ExportAgentPollOptions,
    events?: ExportAgentEvents,
  ): Promise<ExportAgentTerminalResult> {
    if (submission.kind === "failure") {
      return {
        kind: "failure",
        failure: submission.failure,
      };
    }

    if (submission.kind === "immediate_success") {
      return {
        kind: "success",
        result: submission.result,
      };
    }

    return this.pollExportUntilTerminal(submission.handle, options, events);
  }

  async pollExportUntilTerminal(
    handle: ExportJobHandle,
    options?: ExportAgentRequestOptions & ExportAgentPollOptions,
    events?: ExportAgentEvents,
  ): Promise<ExportAgentTerminalResult> {
    const resolved = this.resolvePollOptions(options);
    const startedAt = Date.now();
    let currentHandle = handle;
    let attempt = 0;
    let transientFailures = 0;

    while (true) {
      throwIfAborted(options?.signal);

      if (Date.now() - startedAt > resolved.timeoutMs) {
        return {
          kind: "failure",
          jobId: currentHandle.jobId,
          failure: {
            message: "Export polling timed out.",
            code: "export_poll_timeout",
            details: {
              timeoutMs: resolved.timeoutMs,
            },
          },
        };
      }

      attempt += 1;
      events?.onPollAttempt?.(currentHandle, attempt);

      const result = await pollExportJob(currentHandle, toServiceOptions(options));

      if (result.kind === "terminal_success") {
        return {
          kind: "success",
          result: result.result,
        };
      }

      if (result.kind === "pending") {
        currentHandle = result.handle;
        events?.onPollPending?.(currentHandle, attempt);
        await waitForDelay(resolved.pollDelayMs, options?.signal);
        continue;
      }

      if (
        isTransientPollFailure(result) &&
        transientFailures < resolved.maxTransientFailures
      ) {
        transientFailures += 1;
        events?.onTransientPollFailure?.(currentHandle, attempt, result.failure);
        await waitForDelay(resolved.pollDelayMs, options?.signal);
        continue;
      }

      return {
        kind: "failure",
        jobId: result.jobId ?? currentHandle.jobId,
        failure: result.failure,
      };
    }
  }

  private toStartResult(submission: ExportSubmissionResult): ExportAgentStartResult {
    if (submission.kind === "failure") {
      return {
        kind: "failure",
        failure: submission.failure,
      };
    }

    if (submission.kind === "accepted_job") {
      return {
        kind: "accepted_job",
        handle: submission.handle,
      };
    }

    return {
      kind: "success",
      result: submission.result,
    };
  }

  private resolvePollOptions(
    options?: ExportAgentRequestOptions & ExportAgentPollOptions,
  ): Required<ExportAgentPollOptions> {
    return {
      timeoutMs: options?.timeoutMs ?? this.defaultTimeoutMs,
      maxTransientFailures:
        options?.maxTransientFailures ?? this.defaultMaxTransientFailures,
      pollDelayMs: options?.pollDelayMs ?? this.defaultPollDelayMs,
    };
  }
}

const transientPollFailureCodes = new Set(["http_error", "transport_exception"]);

const isTransientPollFailure = (
  result: Extract<ExportPollResult, { kind: "terminal_failure" }>,
): boolean => transientPollFailureCodes.has(result.failure.code ?? "");

const toServiceOptions = (
  options?: ExportAgentRequestOptions,
): ExportServiceRequestOptions | undefined =>
  options?.signal ? { signal: options.signal } : undefined;

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

export const exportAgent = new DefaultExportAgent();
