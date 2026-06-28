import type {
  AuthCredentialsInput,
  AuthMutationResult,
  AuthSessionResult,
  VerifiedAccountIdentity,
} from "../types/auth";
import {
  BackendRequestAbortedError,
  BackendRequestPolicyError,
  fetchWithBackendRequestPolicy,
  type BackendRequestRetryReason,
} from "./backendRequestPolicy";

interface BackendAccountBootstrapCompleteResponse {
  kind: "account_bootstrap_complete";
  status: "authenticated";
  message?: string;
  identity: VerifiedAccountIdentity;
  bootstrap: {
    appUserCreated: boolean;
    workspaceCreated: boolean;
    membershipCreated: boolean;
  };
}

interface BackendEmailVerificationRequiredResponse {
  kind: "email_verification_required";
  status: "verification_required";
  message?: string;
}

interface BackendWorkspaceBootstrapBlockedResponse {
  kind: "workspace_bootstrap_blocked";
  status: "workspace_selection_required";
  reason: "multiple_active_memberships" | "workspace_selection_required";
  message?: string;
  identity: VerifiedAccountIdentity;
}

interface BackendInvalidBootstrapCredentialsResponse {
  kind: "invalid_credentials";
  status: "unauthenticated";
  reason: "missing_credentials" | "invalid_credentials";
  message?: string;
}

interface BackendBootstrapUnavailableResponse {
  kind: "bootstrap_unavailable";
  status: "auth_not_configured" | "auth_provider_unavailable" | "bootstrap_unavailable";
  message?: string;
}

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

export type BackendAccountBootstrapResponse =
  | BackendAccountBootstrapCompleteResponse
  | BackendEmailVerificationRequiredResponse
  | BackendWorkspaceBootstrapBlockedResponse
  | BackendInvalidBootstrapCredentialsResponse
  | BackendBootstrapUnavailableResponse;

const sessionEndpoint = "/auth/session";
const loginEndpoint = "/auth/login";
const signupEndpoint = "/auth/signup";
const logoutEndpoint = "/auth/logout";
const accountBootstrapEndpoint = "/account/bootstrap";

export interface AuthSessionRequestOptions {
  onRetry?: (reason: BackendRequestRetryReason) => void;
}

interface AuthSessionFlight {
  controller: AbortController;
  key: string;
  promise: Promise<AuthSessionResult>;
  retryListeners: Set<(reason: BackendRequestRetryReason) => void>;
}

let authSessionFlight: AuthSessionFlight | undefined;
let accountBootstrapRevision = 0;
const accountBootstrapFlights = new Map<
  string,
  Promise<BackendAccountBootstrapResponse | undefined>
>();
const accountBootstrapEligibleTokens = new Set<string>();

const createSessionRequestHeaders = (
  accessToken?: string,
): HeadersInit | undefined => {
  if (typeof accessToken !== "string") {
    return undefined;
  }

  const trimmedToken = accessToken.trim();

  if (trimmedToken.length === 0) {
    return undefined;
  }

  return {
    Authorization: `Bearer ${trimmedToken}`,
  };
};

const toFallbackUnavailable = (
  message = "Authentication is currently unavailable because the backend auth boundary could not be reached.",
): AuthSessionResult => ({
  kind: "unavailable",
  status: "unavailable",
  code: "auth_service_unreachable",
  message,
});

const toSessionVerificationUnavailable = (
  code: "backend_wake_timeout" | "session_verification_unavailable",
): AuthSessionResult => ({
  kind: "unavailable",
  status: "unavailable",
  code,
  message:
    code === "backend_wake_timeout"
      ? "The backend did not become ready in time. Your session has not been signed out."
      : "Session verification is temporarily unavailable. Your session has not been signed out.",
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

const requestAuthSession = async (
  accessToken?: string,
  controller?: AbortController,
  onRetry?: (reason: BackendRequestRetryReason) => void,
): Promise<AuthSessionResult> => {
  try {
    const response = await fetchWithBackendRequestPolicy(
      sessionEndpoint,
      {
        method: "GET",
        credentials: "same-origin",
        headers: createSessionRequestHeaders(accessToken),
      },
      {
        mode: "bootstrap_read_once",
        onRetry,
        signal: controller?.signal,
      },
    );

    if (response.status === 401) {
      return {
        kind: "unauthenticated",
        status: "unauthenticated",
        reason: accessToken ? "invalid_credentials" : "missing_credentials",
        message: "Sign in is required for this route.",
      };
    }

    if (response.status === 403) {
      return {
        kind: "unavailable",
        status: "unavailable",
        code: "workspace_forbidden",
        message: "This session does not have access to the requested workspace.",
      };
    }

    if (response.status === 502 || response.status === 503 || response.status === 504) {
      return toSessionVerificationUnavailable("session_verification_unavailable");
    }

    const payload = await parseJson<BackendAuthResponse>(response);

    if (!payload) {
      return toFallbackUnavailable("Authentication returned an empty response.");
    }

    const result = mapBackendAuthResponseToSessionResult(payload);
    if (accessToken && result.kind === "authenticated") {
      if (result.identity.workspaceAuthority === "verified") {
        accountBootstrapEligibleTokens.delete(accessToken);
      } else {
        accountBootstrapEligibleTokens.add(accessToken);
      }
    } else if (accessToken) {
      accountBootstrapEligibleTokens.delete(accessToken);
    }

    return result;
  } catch (error) {
    if (error instanceof BackendRequestAbortedError) {
      throw error;
    }

    if (error instanceof BackendRequestPolicyError) {
      return toSessionVerificationUnavailable(
        error.code === "backend_wake_timeout"
          ? "backend_wake_timeout"
          : "session_verification_unavailable",
      );
    }

    return toFallbackUnavailable();
  }
};

export const invalidateAuthSessionRequests = (): void => {
  authSessionFlight?.controller.abort();
  authSessionFlight = undefined;
};

export const getAuthSession = (
  accessToken?: string,
  options: AuthSessionRequestOptions = {},
): Promise<AuthSessionResult> => {
  const key = accessToken?.trim() || "credentialless";

  if (authSessionFlight?.key === key) {
    if (options.onRetry) {
      authSessionFlight.retryListeners.add(options.onRetry);
    }
    return authSessionFlight.promise;
  }

  invalidateAuthSessionRequests();
  const controller = new AbortController();
  const retryListeners = new Set<(reason: BackendRequestRetryReason) => void>();
  if (options.onRetry) {
    retryListeners.add(options.onRetry);
  }

  let flight: AuthSessionFlight;
  const promise = requestAuthSession(accessToken, controller, (reason) => {
    flight.retryListeners.forEach((listener) => listener(reason));
  }).finally(() => {
    if (authSessionFlight === flight) {
      authSessionFlight = undefined;
    }
  });
  flight = {
    controller,
    key,
    retryListeners,
    promise,
  };
  authSessionFlight = flight;
  return flight.promise;
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

const requestAccountBootstrap = async (
  accessToken: string,
): Promise<BackendAccountBootstrapResponse | undefined> => {
  try {
    const response = await fetch(accountBootstrapEndpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: createSessionRequestHeaders(accessToken),
    });

    return await parseJson<BackendAccountBootstrapResponse>(response);
  } catch {
    return undefined;
  }
};

export const invalidateAccountBootstrapRequests = (): void => {
  accountBootstrapRevision += 1;
  accountBootstrapFlights.clear();
  accountBootstrapEligibleTokens.clear();
};

export const bootstrapAccount = (
  accessToken: string,
): Promise<BackendAccountBootstrapResponse | undefined> => {
  const existing = accountBootstrapFlights.get(accessToken);
  if (existing) {
    return existing;
  }

  if (!accountBootstrapEligibleTokens.has(accessToken)) {
    return Promise.resolve({
      kind: "bootstrap_unavailable",
      status: "bootstrap_unavailable",
      message:
        "Account setup requires an authoritative authenticated session that needs workspace repair.",
    });
  }

  accountBootstrapEligibleTokens.delete(accessToken);
  const revision = accountBootstrapRevision;
  let flight: Promise<BackendAccountBootstrapResponse | undefined>;
  flight = requestAccountBootstrap(accessToken)
    .then((result) => {
      if (revision !== accountBootstrapRevision) {
        return undefined;
      }
      if (result?.kind === "account_bootstrap_complete") {
        accountBootstrapEligibleTokens.delete(accessToken);
      }
      return result;
    })
    .finally(() => {
      if (accountBootstrapFlights.get(accessToken) === flight) {
        accountBootstrapFlights.delete(accessToken);
      }
    });
  accountBootstrapFlights.set(accessToken, flight);
  return flight;
};
