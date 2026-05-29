import {
  getSupabaseAuthClient,
  type SupabaseAuthSessionSnapshot,
} from "./supabaseAuthClient";

export type SupabaseAuthSessionBridgeStatus =
  | {
      kind: "supabase_auth_session_bridge_disabled";
      reason: string;
      unsubscribe(): void;
    }
  | {
      kind: "supabase_auth_session_bridge_active";
      unsubscribe(): void;
    };

export interface SupabaseAuthSessionBridgeOptions {
  refreshBackendSession: (accessToken?: string) => Promise<void>;
}

let activeBridge: SupabaseAuthSessionBridgeStatus | null = null;

const noopUnsubscribe = (): void => {};

const refreshFromSessionSnapshot = async (
  refreshBackendSession: (accessToken?: string) => Promise<void>,
  sessionSnapshot?: SupabaseAuthSessionSnapshot,
): Promise<void> => {
  if (sessionSnapshot?.accessToken) {
    await refreshBackendSession(sessionSnapshot.accessToken);
  }
};

export const initializeSupabaseAuthSessionBridge = async ({
  refreshBackendSession,
}: SupabaseAuthSessionBridgeOptions): Promise<SupabaseAuthSessionBridgeStatus> => {
  if (activeBridge) {
    return activeBridge;
  }

  const authClient = getSupabaseAuthClient();

  if (authClient.kind === "supabase_auth_client_disabled") {
    activeBridge = {
      kind: "supabase_auth_session_bridge_disabled",
      reason: authClient.reason,
      unsubscribe: noopUnsubscribe,
    };
    return activeBridge;
  }

  if (!("auth" in authClient)) {
    activeBridge = {
      kind: "supabase_auth_session_bridge_disabled",
      reason: "client_handle_unavailable",
      unsubscribe: noopUnsubscribe,
    };
    return activeBridge;
  }

  const initialAccessToken = await authClient.auth.getAccessToken();

  if (initialAccessToken.ok && initialAccessToken.data) {
    await refreshBackendSession(initialAccessToken.data);
  }

  const subscription = authClient.auth.onAuthStateChange(
    (_event: string, session: SupabaseAuthSessionSnapshot) => {
      void refreshFromSessionSnapshot(refreshBackendSession, session);
    },
  );

  activeBridge = {
    kind: "supabase_auth_session_bridge_active",
    unsubscribe: () => {
      subscription.unsubscribe();
      activeBridge = null;
    },
  };

  return activeBridge;
};
