import { create } from "zustand";
import { BackendRequestAbortedError } from "../services/backendRequestPolicy";
import { initializeSupabaseAuthSessionBridge } from "../services/auth/supabaseAuthSessionBridge";
import {
  bootstrapAccount,
  getAuthSession,
  invalidateAccountBootstrapRequests,
  invalidateAuthSessionRequests,
} from "../services/authService";
import {
  loginWithSupabaseRuntime,
  logoutFromAuthRuntime,
  signUpWithSupabaseRuntime,
  updatePasswordWithSupabaseRuntime,
} from "../services/auth/authRuntimeService";
import { invalidateProjectLibraryRequests } from "../services/projectLibraryService";
import type {
  AuthBootstrapDiagnosticCode,
  AuthBootstrapPhase,
  AuthCredentialsInput,
  AuthMutationResult,
  AuthRecoveryStatus,
  AuthSessionResult,
  AuthStatus,
  VerifiedAccountIdentity,
} from "../types/auth";
import { useProjectLibraryStore } from "./projectLibraryStore";

export interface AuthStoreState {
  status: AuthStatus;
  identity?: VerifiedAccountIdentity;
  message: string;
  bootstrapPhase: AuthBootstrapPhase;
  bootstrapMessage: string;
  bootstrapDiagnosticCode?: AuthBootstrapDiagnosticCode;
  recoveryStatus: AuthRecoveryStatus;
  recoveryMessage: string;
  reasonCode?: string;
  pendingAction:
    | "refresh"
    | "login"
    | "signup"
    | "logout"
    | "bootstrap"
    | "password_reset"
    | null;
  refreshSession: (accessToken?: string) => Promise<AuthSessionResult | undefined>;
  login: (credentials: AuthCredentialsInput) => Promise<void>;
  signup: (credentials: AuthCredentialsInput) => Promise<void>;
  retryAccountBootstrap: () => Promise<void>;
  markBackendWaking: () => void;
  beginProjectRestoration: () => void;
  completeProjectRestoration: () => void;
  failProjectRestoration: (
    phase: "sign_in_required" | "workspace_forbidden" | "temporarily_unavailable",
  ) => void;
  setRecoveryState: (status: AuthRecoveryStatus, message?: string) => void;
  updateRecoveryPassword: (password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const unknownMessage = "Checking backend session status.";
const unknownRecoveryMessage =
  "Open a valid password recovery link before choosing a new password.";
const projectRestorationMessage = "Restoring verified project context.";

let authRevision = 0;
let currentTokenKey = "unresolved";
let verificationFlight:
  | {
      revision: number;
      promise: Promise<AuthSessionResult | undefined>;
    }
  | undefined;

const invalidateRevisionDependencies = (): void => {
  invalidateAuthSessionRequests();
  invalidateAccountBootstrapRequests();
  invalidateProjectLibraryRequests();
  useProjectLibraryStore.getState().clearRuntimeProjectContext();
};

const beginAuthRevision = (tokenKey: string, force = false): number => {
  if (!force && currentTokenKey === tokenKey) {
    return authRevision;
  }

  authRevision += 1;
  currentTokenKey = tokenKey;
  verificationFlight = undefined;
  invalidateRevisionDependencies();
  return authRevision;
};

const isCurrentRevision = (revision: number): boolean => revision === authRevision;

const toTokenKey = (accessToken?: string): string =>
  accessToken?.trim() ? `token:${accessToken.trim()}` : "credentialless";

const applySessionResult = (
  result: AuthSessionResult | AuthMutationResult,
): Pick<AuthStoreState, "status" | "identity" | "message" | "reasonCode"> => {
  if (result.kind === "authenticated") {
    return {
      status: "authenticated",
      identity: result.identity,
      message: result.message,
      reasonCode: undefined,
    };
  }

  if (result.kind === "logged_out") {
    return {
      status: "unauthenticated",
      identity: undefined,
      message: result.message,
      reasonCode: undefined,
    };
  }

  if (result.kind === "unauthenticated") {
    return {
      status: "unauthenticated",
      identity: undefined,
      message: result.message,
      reasonCode: result.reason,
    };
  }

  return {
    status: "unavailable",
    identity: undefined,
    message: result.message,
    reasonCode: result.code,
  };
};

const toUnavailableBootstrapState = (
  result: Extract<AuthSessionResult, { kind: "unavailable" }>,
): Pick<
  AuthStoreState,
  "bootstrapPhase" | "bootstrapMessage" | "bootstrapDiagnosticCode"
> => {
  if (result.code === "workspace_forbidden") {
    return {
      bootstrapPhase: "workspace_forbidden",
      bootstrapMessage: result.message,
      bootstrapDiagnosticCode: "workspace_forbidden",
    };
  }

  return {
    bootstrapPhase: "temporarily_unavailable",
    bootstrapMessage: result.message,
    bootstrapDiagnosticCode:
      result.code === "backend_wake_timeout"
        ? "backend_wake_timeout"
        : "session_verification_unavailable",
  };
};

export const useAuthStore = create<AuthStoreState>((set) => ({
  status: "unknown",
  identity: undefined,
  message: unknownMessage,
  bootstrapPhase: "starting",
  bootstrapMessage: "Starting secure session restoration.",
  bootstrapDiagnosticCode: undefined,
  recoveryStatus: "recovery_unknown",
  recoveryMessage: unknownRecoveryMessage,
  reasonCode: undefined,
  pendingAction: null,
  refreshSession: (accessToken) => {
    const revision = beginAuthRevision(toTokenKey(accessToken));
    if (verificationFlight?.revision === revision) {
      return verificationFlight.promise;
    }

    set({
      pendingAction: "refresh",
      bootstrapPhase: "verifying_session",
      bootstrapMessage: "Verifying your secure session.",
      bootstrapDiagnosticCode: undefined,
    });

    const promise = getAuthSession(accessToken, {
      onRetry: () => {
        if (!isCurrentRevision(revision)) {
          return;
        }

        set({
          bootstrapPhase: "backend_waking",
          bootstrapMessage: "The backend is waking. Session verification will retry once.",
          bootstrapDiagnosticCode: "backend_waking",
        });
      },
    })
      .then((result) => {
        if (!isCurrentRevision(revision)) {
          return undefined;
        }

        if (result.kind === "authenticated") {
          set({
            ...applySessionResult(result),
            bootstrapPhase: "restoring_project",
            bootstrapMessage: projectRestorationMessage,
            bootstrapDiagnosticCode: undefined,
            pendingAction: null,
          });
          return result;
        }

        if (result.kind === "unauthenticated") {
          useProjectLibraryStore.getState().clearRuntimeProjectContext();
          set({
            ...applySessionResult(result),
            bootstrapPhase: "sign_in_required",
            bootstrapMessage: result.message,
            bootstrapDiagnosticCode: "sign_in_required",
            pendingAction: null,
          });
          return result;
        }

        set((state) => ({
          status: "unavailable",
          identity: state.identity,
          message: result.message,
          reasonCode: result.code,
          ...toUnavailableBootstrapState(result),
          pendingAction: null,
        }));
        return result;
      })
      .catch((error: unknown) => {
        if (!isCurrentRevision(revision) || error instanceof BackendRequestAbortedError) {
          return undefined;
        }

        set((state) => ({
          status: "unavailable",
          identity: state.identity,
          message: "Session verification is temporarily unavailable.",
          reasonCode: "session_verification_unavailable",
          bootstrapPhase: "temporarily_unavailable",
          bootstrapMessage: "Session verification is temporarily unavailable.",
          bootstrapDiagnosticCode: "session_verification_unavailable",
          pendingAction: null,
        }));
        return undefined;
      })
      .finally(() => {
        if (verificationFlight?.revision === revision) {
          verificationFlight = undefined;
        }
      });

    verificationFlight = { revision, promise };
    return promise;
  },
  login: async (credentials) => {
    const revision = beginAuthRevision("login_pending", true);
    set({ pendingAction: "login", bootstrapPhase: "verifying_session" });
    try {
      const result = await loginWithSupabaseRuntime(credentials);
      if (!isCurrentRevision(revision)) {
        return;
      }
      set({
        ...applySessionResult(result),
        bootstrapPhase:
          result.kind === "authenticated"
            ? "restoring_project"
            : result.kind === "unauthenticated"
              ? "sign_in_required"
              : "temporarily_unavailable",
        bootstrapMessage: result.message,
        bootstrapDiagnosticCode:
          result.kind === "unauthenticated"
            ? "sign_in_required"
            : result.kind === "unavailable"
              ? "session_verification_unavailable"
              : undefined,
        pendingAction: null,
      });
    } catch {
      if (isCurrentRevision(revision)) {
        set({
          status: "unavailable",
          message: "Session verification is temporarily unavailable.",
          bootstrapPhase: "temporarily_unavailable",
          bootstrapMessage: "Session verification is temporarily unavailable.",
          bootstrapDiagnosticCode: "session_verification_unavailable",
          pendingAction: null,
        });
      }
    }
  },
  signup: async (credentials) => {
    const revision = beginAuthRevision("signup_pending", true);
    set({ pendingAction: "signup" });
    const result = await signUpWithSupabaseRuntime(credentials);
    if (!isCurrentRevision(revision)) {
      return;
    }
    set({
      ...applySessionResult(result),
      bootstrapPhase:
        result.kind === "authenticated"
          ? "restoring_project"
          : result.kind === "unauthenticated"
            ? "sign_in_required"
            : "temporarily_unavailable",
      bootstrapMessage: result.message,
      bootstrapDiagnosticCode:
        result.kind === "authenticated"
          ? undefined
          : result.kind === "unauthenticated"
            ? "sign_in_required"
            : "session_verification_unavailable",
      pendingAction: null,
    });
  },
  retryAccountBootstrap: async () => {
    const accessToken = currentTokenKey.startsWith("token:")
      ? currentTokenKey.slice("token:".length)
      : undefined;
    if (!accessToken) {
      set({
        status: "unauthenticated",
        identity: undefined,
        message: "Sign in is required before account setup can be retried.",
        reasonCode: "missing_credentials",
        bootstrapPhase: "sign_in_required",
        bootstrapMessage: "Sign in is required before account setup can be retried.",
        bootstrapDiagnosticCode: "sign_in_required",
        pendingAction: null,
      });
      return;
    }

    const sessionResult = await useAuthStore.getState().refreshSession(accessToken);
    if (
      sessionResult?.kind !== "authenticated" ||
      sessionResult.identity.workspaceAuthority === "verified"
    ) {
      return;
    }

    const revision = authRevision;
    set({
      pendingAction: "bootstrap",
      bootstrapPhase: "verifying_session",
      bootstrapMessage: "Completing secure account setup.",
      bootstrapDiagnosticCode: undefined,
    });
    const bootstrapResult = await bootstrapAccount(accessToken);
    if (!isCurrentRevision(revision)) {
      return;
    }

    if (bootstrapResult?.kind === "account_bootstrap_complete") {
      await useAuthStore.getState().refreshSession(accessToken);
      return;
    }

    set((state) => ({
      status: "unavailable",
      identity: state.identity,
      message: bootstrapResult?.message ?? "Account setup is temporarily unavailable.",
      reasonCode: "account_bootstrap_unavailable",
      bootstrapPhase: "temporarily_unavailable",
      bootstrapMessage:
        bootstrapResult?.message ?? "Account setup is temporarily unavailable.",
      bootstrapDiagnosticCode: "session_verification_unavailable",
      pendingAction: null,
    }));
  },
  markBackendWaking: () => {
    set((state) =>
      state.status === "authenticated" &&
      state.pendingAction === null &&
      (state.bootstrapPhase === "restoring_project" ||
        state.bootstrapPhase === "backend_waking")
        ? {
            bootstrapPhase: "backend_waking",
            bootstrapMessage: "The backend is waking. The read will retry once.",
            bootstrapDiagnosticCode: "backend_waking",
          }
        : state,
    );
  },
  beginProjectRestoration: () => {
    set((state) =>
      state.status === "authenticated" &&
      state.pendingAction === null &&
      (state.bootstrapPhase === "restoring_project" ||
        state.bootstrapPhase === "ready" ||
        state.bootstrapPhase === "temporarily_unavailable")
        ? {
            bootstrapPhase: "restoring_project",
            bootstrapMessage: projectRestorationMessage,
            bootstrapDiagnosticCode: undefined,
          }
        : state,
    );
  },
  completeProjectRestoration: () => {
    set((state) =>
      state.status === "authenticated" &&
      state.pendingAction === null &&
      (state.bootstrapPhase === "restoring_project" ||
        state.bootstrapPhase === "backend_waking")
        ? {
            bootstrapPhase: "ready",
            bootstrapMessage: "Session and project context are ready.",
            bootstrapDiagnosticCode: undefined,
          }
        : state,
    );
  },
  failProjectRestoration: (phase) => {
    set((state) =>
      state.status === "authenticated" &&
      state.pendingAction === null &&
      (state.bootstrapPhase === "restoring_project" ||
        state.bootstrapPhase === "backend_waking")
        ? {
            bootstrapPhase: phase,
            bootstrapMessage:
              phase === "sign_in_required"
                ? "Sign in is required to restore project context."
                : phase === "workspace_forbidden"
                  ? "This session does not have access to the requested workspace."
                  : "Project restoration is temporarily unavailable.",
            bootstrapDiagnosticCode:
              phase === "sign_in_required"
                ? "sign_in_required"
                : phase === "workspace_forbidden"
                  ? "workspace_forbidden"
                  : "project_restoration_unavailable",
          }
        : state,
    );
  },
  setRecoveryState: (recoveryStatus, recoveryMessage = unknownRecoveryMessage) => {
    set({ recoveryMessage, recoveryStatus });
  },
  updateRecoveryPassword: async (password) => {
    const revision = authRevision;
    set({ pendingAction: "password_reset" });
    const result = await updatePasswordWithSupabaseRuntime(password);
    if (!isCurrentRevision(revision)) {
      return;
    }
    const sessionState = applySessionResult(result);
    set((state) => ({
      ...sessionState,
      identity: result.kind === "unavailable" ? state.identity : sessionState.identity,
      recoveryStatus:
        result.kind === "logged_out" && result.recoveryStatus
          ? result.recoveryStatus
          : state.recoveryStatus,
      recoveryMessage: result.message,
      pendingAction: null,
    }));
  },
  logout: async () => {
    const revision = beginAuthRevision("logged_out", true);
    set({
      status: "unknown",
      identity: undefined,
      message: "Signing out securely.",
      bootstrapPhase: "starting",
      bootstrapMessage: "Signing out securely.",
      bootstrapDiagnosticCode: undefined,
      pendingAction: "logout",
    });
    const result = await logoutFromAuthRuntime();
    if (!isCurrentRevision(revision)) {
      return;
    }

    if (result.kind === "unavailable") {
      set({
        status: "unavailable",
        identity: undefined,
        message: result.message,
        reasonCode: result.code,
        bootstrapPhase: "temporarily_unavailable",
        bootstrapMessage: result.message,
        bootstrapDiagnosticCode: "session_verification_unavailable",
        pendingAction: null,
      });
      return;
    }

    set({
      ...applySessionResult(result),
      bootstrapPhase: "sign_in_required",
      bootstrapMessage: result.message,
      bootstrapDiagnosticCode: "sign_in_required",
      pendingAction: null,
    });
  },
}));

let authStoreInitialized = false;

export const initializeAuthStore = (): void => {
  if (authStoreInitialized) {
    return;
  }

  authStoreInitialized = true;

  void initializeSupabaseAuthSessionBridge({
    bootstrapBackendAccount: async (accessToken) => {
      const revision = authRevision;
      useAuthStore.setState({
        pendingAction: "bootstrap",
        bootstrapPhase: "verifying_session",
        bootstrapMessage: "Completing secure account setup.",
        bootstrapDiagnosticCode: undefined,
      });
      const result = await bootstrapAccount(accessToken);
      if (!isCurrentRevision(revision)) {
        return false;
      }

      if (result?.kind === "account_bootstrap_complete") {
        useAuthStore.setState({ pendingAction: null });
        return true;
      }

      if (
        result?.kind === "invalid_credentials" ||
        result?.kind === "email_verification_required"
      ) {
        useProjectLibraryStore.getState().clearRuntimeProjectContext();
        useAuthStore.setState({
          status: "unauthenticated",
          identity: undefined,
          message:
            result.message ??
            "Sign in is required before account setup can continue.",
          reasonCode:
            result.kind === "invalid_credentials"
              ? result.reason
              : "email_verification_required",
          bootstrapPhase: "sign_in_required",
          bootstrapMessage:
            result.message ??
            "Sign in is required before account setup can continue.",
          bootstrapDiagnosticCode: "sign_in_required",
          pendingAction: null,
        });
        return false;
      }

      useAuthStore.setState((state) => ({
        status: "unavailable",
        identity: state.identity,
        message: result?.message ?? "Account setup is temporarily unavailable.",
        reasonCode:
          result?.kind === "workspace_bootstrap_blocked"
            ? "workspace_bootstrap_blocked"
            : "account_bootstrap_unavailable",
        bootstrapPhase:
          result?.kind === "workspace_bootstrap_blocked"
            ? "workspace_forbidden"
            : "temporarily_unavailable",
        bootstrapMessage:
          result?.message ?? "Account setup is temporarily unavailable.",
        bootstrapDiagnosticCode:
          result?.kind === "workspace_bootstrap_blocked"
            ? "workspace_forbidden"
            : "session_verification_unavailable",
        pendingAction: null,
      }));
      return false;
    },
    setRecoveryState: (status, message) => {
      useAuthStore.getState().setRecoveryState(status, message);
    },
    refreshBackendSession: (accessToken?: string) =>
      useAuthStore.getState().refreshSession(accessToken),
  });
};

export const selectAuthStatus = (state: AuthStoreState): AuthStatus => state.status;
