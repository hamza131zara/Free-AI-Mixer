export const BOOTSTRAP_READ_ATTEMPT_TIMEOUT_MS = 35_000;
export const BOOTSTRAP_READ_MAX_ATTEMPTS = 2;
export const BOOTSTRAP_READ_RETRY_DELAY_MS = 500;
export const BOOTSTRAP_READ_MAX_EXPECTED_MS =
  BOOTSTRAP_READ_ATTEMPT_TIMEOUT_MS * BOOTSTRAP_READ_MAX_ATTEMPTS +
  BOOTSTRAP_READ_RETRY_DELAY_MS;

export type BackendRequestPolicyMode = "default" | "bootstrap_read_once";
export type BackendRequestRetryReason = "network" | "timeout" | "status";

export class BackendRequestPolicyError extends Error {
  readonly code: "backend_wake_timeout" | "backend_temporarily_unavailable";

  constructor(code: BackendRequestPolicyError["code"]) {
    super(code);
    this.name = "BackendRequestPolicyError";
    this.code = code;
  }
}

export class BackendRequestAbortedError extends Error {
  constructor() {
    super("backend_request_aborted");
    this.name = "BackendRequestAbortedError";
  }
}

export interface BackendRequestPolicyOptions {
  mode?: BackendRequestPolicyMode;
  onRetry?: (reason: BackendRequestRetryReason) => void;
  signal?: AbortSignal;
}

export interface BackendRequestPolicyDependencies {
  fetch: typeof globalThis.fetch;
  setTimeout: typeof globalThis.setTimeout;
  clearTimeout: typeof globalThis.clearTimeout;
  sleep: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}

const sleep = (milliseconds: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new BackendRequestAbortedError());
      return;
    }

    let timeout: ReturnType<typeof globalThis.setTimeout>;
    const handleAbort = (): void => {
      globalThis.clearTimeout(timeout);
      signal?.removeEventListener("abort", handleAbort);
      reject(new BackendRequestAbortedError());
    };
    timeout = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, milliseconds);

    signal?.addEventListener("abort", handleAbort, { once: true });
  });

const defaultDependencies: BackendRequestPolicyDependencies = {
  fetch: globalThis.fetch.bind(globalThis),
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  sleep,
};

const retryableStatuses = new Set([502, 503, 504]);

export const createBackendRequestPolicy = (
  dependencyOverrides: Partial<BackendRequestPolicyDependencies> = {},
) => {
  const dependencies: BackendRequestPolicyDependencies = {
    ...defaultDependencies,
    ...dependencyOverrides,
  };
  const fetchWithAttemptTimeout = async (
    input: RequestInfo | URL,
    init: RequestInit,
    externalSignal?: AbortSignal,
  ): Promise<Response> => {
    if (externalSignal?.aborted) {
      throw new BackendRequestAbortedError();
    }

    const controller = new AbortController();
    let policyTimedOut = false;
    const handleExternalAbort = (): void => controller.abort();
    externalSignal?.addEventListener("abort", handleExternalAbort, { once: true });
    const timeout = dependencies.setTimeout(() => {
      policyTimedOut = true;
      controller.abort();
    }, BOOTSTRAP_READ_ATTEMPT_TIMEOUT_MS);

    try {
      return await dependencies.fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (externalSignal?.aborted) {
        throw new BackendRequestAbortedError();
      }

      if (policyTimedOut) {
        throw new BackendRequestPolicyError("backend_wake_timeout");
      }

      throw error;
    } finally {
      dependencies.clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", handleExternalAbort);
    }
  };

  return async (
    input: RequestInfo | URL,
    init: RequestInit = {},
    options: BackendRequestPolicyOptions = {},
  ): Promise<Response> => {
    const method = (init.method ?? "GET").toUpperCase();
    const bootstrapReadEnabled =
      options.mode === "bootstrap_read_once" && method === "GET";

    if (!bootstrapReadEnabled) {
      return dependencies.fetch(input, init);
    }

    let lastFailure: BackendRequestRetryReason = "network";

    for (let attempt = 1; attempt <= BOOTSTRAP_READ_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetchWithAttemptTimeout(
          input,
          init,
          options.signal,
        );

        if (!retryableStatuses.has(response.status)) {
          return response;
        }

        lastFailure = "status";
        if (attempt === BOOTSTRAP_READ_MAX_ATTEMPTS) {
          return response;
        }
      } catch (error) {
        if (error instanceof BackendRequestAbortedError) {
          throw error;
        }

        lastFailure =
          error instanceof BackendRequestPolicyError &&
          error.code === "backend_wake_timeout"
            ? "timeout"
            : "network";

        if (attempt === BOOTSTRAP_READ_MAX_ATTEMPTS) {
          throw new BackendRequestPolicyError(
            lastFailure === "timeout"
              ? "backend_wake_timeout"
              : "backend_temporarily_unavailable",
          );
        }
      }

      options.onRetry?.(lastFailure);
      await dependencies.sleep(BOOTSTRAP_READ_RETRY_DELAY_MS, options.signal);
    }

    throw new BackendRequestPolicyError("backend_temporarily_unavailable");
  };
};

export const fetchWithBackendRequestPolicy = createBackendRequestPolicy();
