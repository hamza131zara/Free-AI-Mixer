import { create } from "zustand";
import { initializeSupabaseAuthSessionBridge } from "../services/auth/supabaseAuthSessionBridge";
import {
  getAuthSession,
  loginWithBackendAuth,
  logoutFromBackendAuth,
  signupWithBackendAuth,
} from "../services/authService";
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
  pendingAction: "refresh" | "login" | "signup" | "logout" | null;
  refreshSession: (accessToken?: string) => Promise<void>;
  login: (credentials: AuthCredentialsInput) => Promise<void>;
  signup: (credentials: AuthCredentialsInput) => Promise<void>;
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
    const result = await loginWithBackendAuth(credentials);
    set({
      ...applySessionResult(result),
      pendingAction: null,
    });
  },
  signup: async (credentials) => {
    set({ pendingAction: "signup" });
    const result = await signupWithBackendAuth(credentials);
    set({
      ...applySessionResult(result),
      pendingAction: null,
    });
  },
  logout: async () => {
    set({ pendingAction: "logout" });
    const result = await logoutFromBackendAuth();
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
    refreshBackendSession: async (accessToken?: string) => {
      await useAuthStore.getState().refreshSession(accessToken);
    },
  }).then((bridge) => {
    if (bridge.kind === "supabase_auth_session_bridge_disabled") {
      void useAuthStore.getState().refreshSession();
    }
  });
};

export const selectAuthStatus = (state: AuthStoreState): AuthStatus => state.status;
