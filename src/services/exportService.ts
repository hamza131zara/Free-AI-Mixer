import type {
  ExportArtifactRef,
  ExportFailure,
  ExportJobHandle,
  ExportPollResult,
  ExportProgressSnapshot,
  ExportSubmissionResult,
  ExportTerminalResult,
  TimelineExportRequest,
} from "../types/exportJob";

// Phase 5.2A service contracts only.
// This service is not wired into app runtime yet.
// Backend render API may be unavailable unless explicitly configured.
// Frontend must not fake export completion, artifacts, progress, or cancellation.

export interface ExportServiceRequestOptions {
  signal?: AbortSignal;
}

export type ExportArtifactInfoResult =
  | {
      kind: "success";
      artifacts: ExportArtifactRef[];
    }
  | {
      kind: "failure";
      failure: ExportFailure;
    };

interface ExportServiceRuntimeConfig {
  exportBaseUrl?: string;
  exportSubmitPath?: string;
  exportPollPath?: string;
  exportArtifactsPath?: string;
}

const normalizeBaseUrl = (baseUrl?: string): string | undefined => {
  const trimmed = baseUrl?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : undefined;
};

const normalizePath = (path: string): string =>
  path.startsWith("/") ? path : `/${path}`;

const resolveRuntimeConfig = (): ExportServiceRuntimeConfig => {
  if (typeof window === "undefined") {
    return {};
  }

  const runtimeWindow = window as Window & {
    __FREE_AI_MIXER_RUNTIME_CONFIG__?: ExportServiceRuntimeConfig;
  };
  return runtimeWindow.__FREE_AI_MIXER_RUNTIME_CONFIG__ ?? {};
};

const hasRuntimeConfigValue = (
  config: ExportServiceRuntimeConfig,
  key: keyof ExportServiceRuntimeConfig,
): boolean => Object.prototype.hasOwnProperty.call(config, key);

const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const toFailure = (
  message: string,
  code: string,
  details?: unknown,
): ExportFailure => ({
  message,
  code,
  details,
});

const toTransportFailure = (
  message: string,
  error: unknown,
): ExportFailure =>
  toFailure(message, "transport_exception", {
    cause:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
          }
        : error,
  });

const isExportArtifactRef = (value: unknown): value is ExportArtifactRef => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const artifact = value as Partial<ExportArtifactRef>;
  return typeof artifact.id === "string";
};

const isExportTerminalResult = (value: unknown): value is ExportTerminalResult => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ExportTerminalResult>;
  return (
    typeof candidate.provider === "string" &&
    typeof candidate.requestId === "string" &&
    typeof candidate.jobId === "string" &&
    Array.isArray(candidate.artifacts) &&
    candidate.artifacts.every(isExportArtifactRef)
  );
};

const isExportJobHandle = (value: unknown): value is ExportJobHandle => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ExportJobHandle>;
  return (
    typeof candidate.provider === "string" &&
    typeof candidate.requestId === "string" &&
    typeof candidate.jobId === "string" &&
    (candidate.status === "submitted" ||
      candidate.status === "rendering" ||
      candidate.status === "finalizing")
  );
};

const toExportSubmissionResult = (value: unknown): ExportSubmissionResult | undefined => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = value as {
    kind?: unknown;
    result?: unknown;
    handle?: unknown;
    failure?: unknown;
  };

  if (candidate.kind === "immediate_success" && isExportTerminalResult(candidate.result)) {
    return {
      kind: "immediate_success",
      result: candidate.result,
    };
  }

  if (candidate.kind === "accepted_job" && isExportJobHandle(candidate.handle)) {
    return {
      kind: "accepted_job",
      handle: candidate.handle,
    };
  }

  if (candidate.kind === "failure" && isExportFailure(candidate.failure)) {
    return {
      kind: "failure",
      failure: candidate.failure,
    };
  }

  return undefined;
};

const isExportFailure = (value: unknown): value is ExportFailure => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ExportFailure>;
  return typeof candidate.message === "string";
};

const toExportPollResult = (value: unknown): ExportPollResult | undefined => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = value as {
    kind?: unknown;
    handle?: unknown;
    result?: unknown;
    failure?: unknown;
    progress?: unknown;
    jobId?: unknown;
  };

  if (candidate.kind === "pending" && isExportJobHandle(candidate.handle)) {
    return {
      kind: "pending",
      handle: candidate.handle,
      progress: toProgressSnapshot(candidate.progress),
    };
  }

  if (candidate.kind === "terminal_success" && isExportTerminalResult(candidate.result)) {
    return {
      kind: "terminal_success",
      result: candidate.result,
    };
  }

  if (candidate.kind === "terminal_failure" && isExportFailure(candidate.failure)) {
    return {
      kind: "terminal_failure",
      failure: candidate.failure,
      jobId: typeof candidate.jobId === "string" ? candidate.jobId : undefined,
    };
  }

  return undefined;
};

const toProgressSnapshot = (value: unknown): ExportProgressSnapshot | undefined => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = value as Partial<ExportProgressSnapshot>;
  if (typeof candidate.stage !== "string") {
    return undefined;
  }

  return {
    stage: candidate.stage,
    statusMessage:
      typeof candidate.statusMessage === "string"
        ? candidate.statusMessage
        : undefined,
    percent: typeof candidate.percent === "number" ? candidate.percent : undefined,
    updatedAt:
      typeof candidate.updatedAt === "string" ? candidate.updatedAt : undefined,
  };
};

const toArtifactsResult = (value: unknown): ExportArtifactInfoResult | undefined => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = value as {
    artifacts?: unknown;
    failure?: unknown;
    kind?: unknown;
  };

  if (candidate.kind === "failure" && isExportFailure(candidate.failure)) {
    return {
      kind: "failure",
      failure: candidate.failure,
    };
  }

  if (Array.isArray(candidate.artifacts) && candidate.artifacts.every(isExportArtifactRef)) {
    return {
      kind: "success",
      artifacts: candidate.artifacts,
    };
  }

  return undefined;
};

const runtimeConfig = resolveRuntimeConfig();
const env = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env;

const exportServiceConfig = {
  baseUrl: normalizeBaseUrl(
    hasRuntimeConfigValue(runtimeConfig, "exportBaseUrl")
      ? runtimeConfig.exportBaseUrl
      : env?.VITE_EXPORT_API_BASE_URL,
  ),
  submitPath: normalizePath(
    hasRuntimeConfigValue(runtimeConfig, "exportSubmitPath")
      ? runtimeConfig.exportSubmitPath ?? "/exports/jobs"
      : env?.VITE_EXPORT_SUBMIT_PATH ?? "/exports/jobs",
  ),
  pollPath: normalizePath(
    hasRuntimeConfigValue(runtimeConfig, "exportPollPath")
      ? runtimeConfig.exportPollPath ?? "/exports/jobs"
      : env?.VITE_EXPORT_POLL_PATH ?? "/exports/jobs",
  ),
  artifactsPath: normalizePath(
    hasRuntimeConfigValue(runtimeConfig, "exportArtifactsPath")
      ? runtimeConfig.exportArtifactsPath ?? "/exports/jobs"
      : env?.VITE_EXPORT_ARTIFACTS_PATH ?? "/exports/jobs",
  ),
};

export const submitExportJob = async (
  request: TimelineExportRequest,
  options?: ExportServiceRequestOptions,
): Promise<ExportSubmissionResult> => {
  if (!exportServiceConfig.baseUrl) {
    return {
      kind: "failure",
      failure: toFailure(
        "Export API base URL is not configured.",
        "missing_export_api_base_url",
        {
          submitPath: exportServiceConfig.submitPath,
        },
      ),
    };
  }

  try {
    const response = await fetch(
      `${exportServiceConfig.baseUrl}${exportServiceConfig.submitPath}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: options?.signal,
      },
    );

    const body = await readJson(response);

    if (!response.ok) {
      return {
        kind: "failure",
        failure: toFailure(
          `Export submit request failed with status ${response.status}.`,
          "http_error",
          {
            status: response.status,
            statusText: response.statusText,
            body,
          },
        ),
      };
    }

    const result = toExportSubmissionResult(body);
    if (result) {
      return result;
    }

    return {
      kind: "failure",
      failure: toFailure(
        "Export submit response payload is invalid.",
        "invalid_response_payload",
        { body },
      ),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    return {
      kind: "failure",
      failure: toTransportFailure("Export submit transport request failed.", error),
    };
  }
};

export const pollExportJob = async (
  handle: ExportJobHandle,
  options?: ExportServiceRequestOptions,
): Promise<ExportPollResult> => {
  if (!exportServiceConfig.baseUrl) {
    return {
      kind: "terminal_failure",
      jobId: handle.jobId,
      failure: toFailure(
        "Export API base URL is not configured.",
        "missing_export_api_base_url",
        {
          pollPath: exportServiceConfig.pollPath,
        },
      ),
    };
  }

  try {
    const response = await fetch(
      `${exportServiceConfig.baseUrl}${exportServiceConfig.pollPath}/${encodeURIComponent(handle.jobId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: options?.signal,
      },
    );

    const body = await readJson(response);

    if (!response.ok) {
      const isNotFound = response.status === 404;
      return {
        kind: "terminal_failure",
        jobId: handle.jobId,
        failure: toFailure(
          isNotFound
            ? "Export job was not found."
            : `Export poll request failed with status ${response.status}.`,
          isNotFound ? "export_job_not_found" : "http_error",
          {
            status: response.status,
            statusText: response.statusText,
            body,
          },
        ),
      };
    }

    const result = toExportPollResult(body);
    if (result) {
      return result;
    }

    return {
      kind: "terminal_failure",
      jobId: handle.jobId,
      failure: toFailure(
        "Export poll response payload is invalid.",
        "invalid_response_payload",
        { body },
      ),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    return {
      kind: "terminal_failure",
      jobId: handle.jobId,
      failure: toTransportFailure("Export poll transport request failed.", error),
    };
  }
};

export const getExportArtifactInfo = async (
  handle: ExportJobHandle,
  options?: ExportServiceRequestOptions,
): Promise<ExportArtifactInfoResult> => {
  if (!exportServiceConfig.baseUrl) {
    return {
      kind: "failure",
      failure: toFailure(
        "Export API base URL is not configured.",
        "missing_export_api_base_url",
        {
          artifactsPath: exportServiceConfig.artifactsPath,
        },
      ),
    };
  }

  try {
    const response = await fetch(
      `${exportServiceConfig.baseUrl}${exportServiceConfig.artifactsPath}/${encodeURIComponent(handle.jobId)}/artifacts`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: options?.signal,
      },
    );

    const body = await readJson(response);

    if (!response.ok) {
      return {
        kind: "failure",
        failure: toFailure(
          `Export artifact request failed with status ${response.status}.`,
          "http_error",
          {
            status: response.status,
            statusText: response.statusText,
            body,
          },
        ),
      };
    }

    const result = toArtifactsResult(body);
    if (result) {
      return result;
    }

    return {
      kind: "failure",
      failure: toFailure(
        "Export artifact response payload is invalid.",
        "invalid_response_payload",
        { body },
      ),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    return {
      kind: "failure",
      failure: toTransportFailure("Export artifact transport request failed.", error),
    };
  }
};
