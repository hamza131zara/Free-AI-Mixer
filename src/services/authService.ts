import type {
  AuthCredentialsInput,
  AuthMutationResult,
  AuthSessionResult,
  VerifiedAccountIdentity,
} from "../types/auth";

interface BackendAuthenticatedSessionResponse {
  kind: "authenticated_session";
  status: "authenticated";
  message?: string;
  identity: VerifiedAccountIdentity;
}

interface BackendUnauthenticatedSessionResponse {
  kind: "unauthenticated_session";
  status: "unauthenticated";
  message?: string;
  reason: "missing_credentials" | "invalid_credentials";
}

interface BackendUnavailableSessionResponse {
  kind: "auth_unavailable";
  status: "auth_not_configured" | "auth_provider_unavailable";
  message?: string;
}

interface BackendLoggedOutResponse {
  kind: "logged_out";
  status: "unauthenticated";
  message?: string;
}

type BackendAuthResponse =
  | BackendAuthenticatedSessionResponse
  | BackendUnauthenticatedSessionResponse
  | BackendUnavailableSessionResponse
  | BackendLoggedOutResponse;

const sessionEndpoint = "/auth/session";
const loginEndpoint = "/auth/login";
const signupEndpoint = "/auth/signup";
const logoutEndpoint = "/auth/logout";

const toFallbackUnavailable = (
  message = "Authentication is currently unavailable because the backend auth boundary could not be reached.",
): AuthSessionResult => ({
  kind: "unavailable",
  status: "unavailable",
  code: "auth_service_unreachable",
  message,
});

const mapBackendAuthResponseToSessionResult = (
  payload: BackendAuthResponse,
): AuthSessionResult => {
  if (payload.kind === "authenticated_session") {
    return {
      kind: "authenticated",
      status: "authenticated",
      identity: payload.identity,
      message: payload.message ?? "Backend session verified.",
    };
  }

  if (payload.kind === "unauthenticated_session") {
    return {
      kind: "unauthenticated",
      status: "unauthenticated",
      reason: payload.reason,
      message: payload.message ?? "Sign in is required for this route.",
    };
  }

  if (payload.kind === "auth_unavailable") {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: payload.status,
      message:
        payload.message ??
        (payload.status === "auth_not_configured"
          ? "Authentication is not configured on this backend yet."
          : "Authentication is configured but not available in this product phase."),
    };
  }

  return {
    kind: "unavailable",
    status: "unavailable",
    code: "auth_service_unreachable",
    message: payload.message ?? "Authentication is currently unavailable.",
  };
};

const parseJson = async <Payload>(response: Response): Promise<Payload | undefined> => {
  const responseText = await response.text();

  if (!responseText) {
    return undefined;
  }

  return JSON.parse(responseText) as Payload;
};

const postCredentials = async (
  endpoint: string,
  credentials: AuthCredentialsInput,
): Promise<AuthSessionResult> => {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify(credentials),
    });
    const payload = await parseJson<BackendAuthResponse>(response);

    if (!payload) {
      return toFallbackUnavailable("Authentication returned an empty response.");
    }

    return mapBackendAuthResponseToSessionResult(payload);
  } catch {
    return toFallbackUnavailable();
  }
};

export const getAuthSession = async (): Promise<AuthSessionResult> => {
  try {
    const response = await fetch(sessionEndpoint, {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendAuthResponse>(response);

    if (!payload) {
      return toFallbackUnavailable("Authentication returned an empty response.");
    }

    return mapBackendAuthResponseToSessionResult(payload);
  } catch {
    return toFallbackUnavailable();
  }
};

export const loginWithBackendAuth = async (
  credentials: AuthCredentialsInput,
): Promise<AuthSessionResult> => postCredentials(loginEndpoint, credentials);

export const signupWithBackendAuth = async (
  credentials: AuthCredentialsInput,
): Promise<AuthSessionResult> => postCredentials(signupEndpoint, credentials);

export const logoutFromBackendAuth = async (): Promise<AuthMutationResult> => {
  try {
    const response = await fetch(logoutEndpoint, {
      method: "POST",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendAuthResponse>(response);

    if (!payload) {
      return toFallbackUnavailable("Authentication returned an empty response.");
    }

    if (payload.kind === "logged_out") {
      return {
        kind: "logged_out",
        status: "unauthenticated",
        message: payload.message ?? "Session cleared.",
      };
    }

    return mapBackendAuthResponseToSessionResult(payload);
  } catch {
    return toFallbackUnavailable();
  }
};
