import type {
  ExportHistoryStatusResult,
  ExportHistorySummary,
} from "../types/exportHistory";

interface BackendAuthenticatedExportHistoryResponse {
  kind: "export_history";
  status: "authenticated";
  message?: string;
  activeWorkspaceId?: string;
  historyState: "not_enabled_yet";
  exports: ExportHistorySummary[];
}

interface BackendUnauthenticatedExportHistoryResponse {
  kind: "export_history_sign_in_required";
  status: "unauthenticated";
  reason: "missing_credentials" | "invalid_credentials";
  message?: string;
}

interface BackendUnavailableExportHistoryResponse {
  kind: "export_history_unavailable";
  status: "auth_not_configured" | "auth_provider_unavailable";
  message?: string;
}

type BackendExportHistoryResponse =
  | BackendAuthenticatedExportHistoryResponse
  | BackendUnauthenticatedExportHistoryResponse
  | BackendUnavailableExportHistoryResponse;

const exportHistoryEndpoint = "/project-library/history";

const parseJson = async <Payload>(response: Response): Promise<Payload | undefined> => {
  const responseText = await response.text();

  if (!responseText) {
    return undefined;
  }

  try {
    return JSON.parse(responseText) as Payload;
  } catch {
    return undefined;
  }
};

const toUnavailable = (message: string): ExportHistoryStatusResult => ({
  kind: "unavailable",
  status: "unavailable",
  code: "export_history_service_unreachable",
  message,
});

const mapResponse = (
  payload: BackendExportHistoryResponse,
): ExportHistoryStatusResult => {
  if (payload.kind === "export_history") {
    return {
      kind: "authenticated",
      status: "authenticated",
      message:
        payload.message ??
        "Export history is available for this verified session, but durable account-linked history is not enabled yet.",
      activeWorkspaceId: payload.activeWorkspaceId,
      historyState: payload.historyState,
      exports: payload.exports,
    };
  }

  if (payload.kind === "export_history_sign_in_required") {
    return {
      kind: "unauthenticated",
      status: "unauthenticated",
      reason: payload.reason,
      message:
        payload.message ??
        "Sign in is required before verified backend export history can appear here.",
    };
  }

  return {
    kind: "unavailable",
    status: "unavailable",
    code: payload.status,
    message:
      payload.message ??
      (payload.status === "auth_not_configured"
        ? "Authentication is not configured on this backend yet."
        : "Export history is configured behind auth, but not available in this product phase."),
  };
};

export const getExportHistoryStatus = async (): Promise<ExportHistoryStatusResult> => {
  try {
    const response = await fetch(exportHistoryEndpoint, {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendExportHistoryResponse>(response);

    if (!payload) {
      return toUnavailable("Export history returned an empty response.");
    }

    return mapResponse(payload);
  } catch {
    return toUnavailable(
      "Export history is currently unavailable because the backend boundary could not be reached.",
    );
  }
};
