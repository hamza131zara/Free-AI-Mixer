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
} from "../services/auth/authRuntimeService";
import type {
  AuthCredentialsInput,
  AuthMutationResult,
  AuthSessionResult,
  AuthStatus,
  VerifiedAccountIdentity,
} from "../types/auth";

export interface AuthStoreState {
  status: AuthStatus;
  identity?: VerifiedAccountIdentity;
  message: string;
  reasonCode?: string;
  pendingAction: "refresh" | "login" | "signup" | "logout" | "bootstrap" | null;
  refreshSession: (accessToken?: string) => Promise<void>;
  login: (credentials: AuthCredentialsInput) => Promise<void>;
  signup: (credentials: AuthCredentialsInput) => Promise<void>;
  retryAccountBootstrap: () => Promise<void>;
  logout: () => Promise<void>;
}

const unknownMessage = "Checking backend session status.";

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
  logout: async () => {
    set({ pendingAction: "logout" });
    const result = await logoutFromAuthRuntime();
    set({
      ...applySessionResult(result),
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
    bootstrapBackendAccount: async () => {
      await useAuthStore.getState().retryAccountBootstrap();
    },
    refreshBackendSession: async (accessToken?: string) => {
      await useAuthStore.getState().refreshSession(accessToken);
    },
  });
};

export const selectAuthStatus = (state: AuthStoreState): AuthStatus => state.status;
