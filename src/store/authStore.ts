import { create } from "zustand";
import { initializeSupabaseAuthSessionBridge } from "../services/auth/supabaseAuthSessionBridge";
import {
  getAuthSession,
} from "../services/authService";
import {
  loginWithSupabaseRuntime,
  logoutFromAuthRuntime,
  retryAccountBootstrapWithSupabaseRuntime,
  signUpWithSupabaseRuntime,
  updatePasswordWithSupabaseRuntime,
} from "../services/auth/authRuntimeService";
import type {
  AuthCredentialsInput,
  AuthMutationResult,
  AuthRecoveryStatus,
  AuthSessionResult,
  AuthStatus,
  VerifiedAccountIdentity,
} from "../types/auth";

export interface AuthStoreState {
  status: AuthStatus;
  identity?: VerifiedAccountIdentity;
  message: string;
  recoveryStatus: AuthRecoveryStatus;
  recoveryMessage: string;
  reasonCode?: string;
  pendingAction: "refresh" | "login" | "signup" | "logout" | "bootstrap" | "password_reset" | null;
  refreshSession: (accessToken?: string) => Promise<void>;
  login: (credentials: AuthCredentialsInput) => Promise<void>;
  signup: (credentials: AuthCredentialsInput) => Promise<void>;
  retryAccountBootstrap: () => Promise<void>;
  setRecoveryState: (status: AuthRecoveryStatus, message?: string) => void;
  updateRecoveryPassword: (password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const unknownMessage = "Checking backend session status.";
const unknownRecoveryMessage =
  "Open a valid password recovery link before choosing a new password.";

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

export const useAuthStore = create<AuthStoreState>((set) => ({
  status: "unknown",
  identity: undefined,
  message: unknownMessage,
  recoveryStatus: "recovery_unknown",
  recoveryMessage: unknownRecoveryMessage,
  reasonCode: undefined,
  pendingAction: null,
  refreshSession: async (accessToken) => {
    set({ pendingAction: "refresh" });
    const result = await getAuthSession(accessToken);
    set({
      ...applySessionResult(result),
      pendingAction: null,
    });
  },
  login: async (credentials) => {
    set({ pendingAction: "login" });
    const result = await loginWithSupabaseRuntime(credentials);
    set({
      ...applySessionResult(result),
      pendingAction: null,
    });
  },
  signup: async (credentials) => {
    set({ pendingAction: "signup" });
    const result = await signUpWithSupabaseRuntime(credentials);
    set({
      ...applySessionResult(result),
      pendingAction: null,
    });
  },
  retryAccountBootstrap: async () => {
    set({ pendingAction: "bootstrap" });
    const result = await retryAccountBootstrapWithSupabaseRuntime();
    set({
      ...applySessionResult(result),
      pendingAction: null,
    });
  },
  setRecoveryState: (recoveryStatus, recoveryMessage = unknownRecoveryMessage) => {
    set({
      recoveryMessage,
      recoveryStatus,
    });
  },
  updateRecoveryPassword: async (password) => {
    set({ pendingAction: "password_reset" });
    const result = await updatePasswordWithSupabaseRuntime(password);
    const sessionState = applySessionResult(result);

    set((state) => ({
      ...sessionState,
      identity:
        result.kind === "unavailable"
          ? state.identity
          : sessionState.identity,
      recoveryStatus:
        result.kind === "logged_out" && result.recoveryStatus
          ? result.recoveryStatus
          : state.recoveryStatus,
      recoveryMessage: result.message,
      pendingAction: null,
    }));
  },
  logout: async () => {
    set({ pendingAction: "logout" });
    const result = await logoutFromAuthRuntime();
    set((state) => {
      if (result.kind === "unavailable") {
        return {
          status: "unavailable",
          identity: state.identity,
          message: result.message,
          reasonCode: result.code,
          pendingAction: null,
        };
      }

      return {
        ...applySessionResult(result),
        pendingAction: null,
      };
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
    bootstrapBackendAccount: async () => {
      await useAuthStore.getState().retryAccountBootstrap();
    },
    setRecoveryState: (status, message) => {
      useAuthStore.getState().setRecoveryState(status, message);
    },
    refreshBackendSession: async (accessToken?: string) => {
      await useAuthStore.getState().refreshSession(accessToken);
      const state = useAuthStore.getState();

      if (state.status === "authenticated" && state.identity) {
        return {
          kind: "authenticated" as const,
          status: "authenticated" as const,
          identity: state.identity,
          message: state.message,
        };
      }

      if (state.status === "unauthenticated") {
        return {
          kind: "unauthenticated" as const,
          status: "unauthenticated" as const,
          reason:
            state.reasonCode === "invalid_credentials" ||
            state.reasonCode === "email_verification_required"
              ? state.reasonCode
              : "missing_credentials",
          message: state.message,
        };
      }

      if (state.status === "unavailable") {
        return {
          kind: "unavailable" as const,
          status: "unavailable" as const,
          code:
            state.reasonCode === "auth_not_configured" ||
            state.reasonCode === "auth_provider_unavailable" ||
            state.reasonCode === "supabase_auth_not_configured" ||
            state.reasonCode === "email_verification_required" ||
            state.reasonCode === "workspace_bootstrap_blocked" ||
            state.reasonCode === "account_bootstrap_unavailable"
              ? state.reasonCode
              : "auth_service_unreachable",
          message: state.message,
        };
      }

      return undefined;
    },
  });
};

export const selectAuthStatus = (state: AuthStoreState): AuthStatus => state.status;
