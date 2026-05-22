export type ArtifactDeliveryUnavailableReason =
  | "authorization_required"
  | "workspace_or_rls_not_ready"
  | "storage_not_configured"
  | "artifact_not_ready"
  | "not_configured";

export type ArtifactDeliveryDescriptorServiceResult =
  | {
      kind: "unavailable";
      reason: ArtifactDeliveryUnavailableReason;
    }
  | {
      kind: "ready";
      deliveryMode: "backend_mediated";
      jobId: string;
      artifactId: string;
      backendRoutePath: string;
      expiresAt: string;
    }
  | {
      kind: "ready";
      deliveryMode: "backend_signed_url";
      jobId: string;
      artifactId: string;
      signedUrl: string;
      expiresAt: string;
    }
  | {
      kind: "error";
      reason:
        | "invalid_request"
        | "unauthorized"
        | "forbidden"
        | "not_found"
        | "request_failed"
        | "invalid_response"
        | "transport_error"
        | "aborted";
      status?: number;
    };

export interface ArtifactDeliveryDescriptorServiceOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}

const unavailableReasons = new Set<string>([
  "authorization_required",
  "workspace_or_rls_not_ready",
  "storage_not_configured",
  "artifact_not_ready",
  "not_configured",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const buildArtifactDeliveryDescriptorPath = (
  jobId: string,
  artifactId: string,
): string =>
  `/exports/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(
    artifactId,
  )}/delivery`;

export const parseArtifactDeliveryDescriptorPayload = (
  payload: unknown,
): ArtifactDeliveryDescriptorServiceResult => {
  if (!isRecord(payload)) {
    return {
      kind: "error",
      reason: "invalid_response",
    };
  }

  if (payload.kind === "artifact_delivery_unavailable") {
    if (typeof payload.reason !== "string" || !unavailableReasons.has(payload.reason)) {
      return {
        kind: "error",
        reason: "invalid_response",
      };
    }

    return {
      kind: "unavailable",
      reason: payload.reason as ArtifactDeliveryUnavailableReason,
    };
  }

  if (payload.kind === "artifact_delivery_ready") {
    if (
      typeof payload.jobId !== "string" ||
      typeof payload.artifactId !== "string" ||
      typeof payload.expiresAt !== "string"
    ) {
      return {
        kind: "error",
        reason: "invalid_response",
      };
    }

    if (payload.deliveryMode === "backend_mediated") {
      if (typeof payload.backendRoutePath !== "string") {
        return {
          kind: "error",
          reason: "invalid_response",
        };
      }

      return {
        kind: "ready",
        deliveryMode: "backend_mediated",
        jobId: payload.jobId,
        artifactId: payload.artifactId,
        backendRoutePath: payload.backendRoutePath,
        expiresAt: payload.expiresAt,
      };
    }

    if (payload.deliveryMode === "backend_signed_url") {
      if (typeof payload.signedUrl !== "string") {
        return {
          kind: "error",
          reason: "invalid_response",
        };
      }

      return {
        kind: "ready",
        deliveryMode: "backend_signed_url",
        jobId: payload.jobId,
        artifactId: payload.artifactId,
        signedUrl: payload.signedUrl,
        expiresAt: payload.expiresAt,
      };
    }

    return {
      kind: "error",
      reason: "invalid_response",
    };
  }

  return {
    kind: "error",
    reason: "invalid_response",
  };
};

export const getArtifactDeliveryDescriptor = async (
  jobId: string,
  artifactId: string,
  options: ArtifactDeliveryDescriptorServiceOptions = {},
): Promise<ArtifactDeliveryDescriptorServiceResult> => {
  if (!jobId.trim() || !artifactId.trim()) {
    return {
      kind: "error",
      reason: "invalid_request",
    };
  }

  const path = buildArtifactDeliveryDescriptorPath(jobId, artifactId);
  const url = options.baseUrl ? `${options.baseUrl.replace(/\/$/, "")}${path}` : path;
  const fetchFn = options.fetchFn ?? globalThis.fetch;

  try {
    const response = await fetchFn(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: options.signal,
    });

    if (response.status === 401) {
      return {
        kind: "error",
        reason: "unauthorized",
        status: response.status,
      };
    }

    if (response.status === 403) {
      return {
        kind: "error",
        reason: "forbidden",
        status: response.status,
      };
    }

    if (response.status === 404) {
      return {
        kind: "error",
        reason: "not_found",
        status: response.status,
      };
    }

    if (!response.ok) {
      return {
        kind: "error",
        reason: "request_failed",
        status: response.status,
      };
    }

    const payload = await response.json();

    return parseArtifactDeliveryDescriptorPayload(payload);
  } catch (error) {
    if (isRecord(error) && error.name === "AbortError") {
      return {
        kind: "error",
        reason: "aborted",
      };
    }

    return {
      kind: "error",
      reason: "transport_error",
    };
  }
};
