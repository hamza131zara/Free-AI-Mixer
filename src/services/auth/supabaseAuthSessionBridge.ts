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
  bootstrapBackendAccount?: (accessToken: string) => Promise<void>;
  refreshBackendSession: (accessToken?: string) => Promise<void>;
}

let activeBridge: SupabaseAuthSessionBridgeStatus | null = null;

const noopUnsubscribe = (): void => {};

const refreshFromSessionSnapshot = async (
  refreshBackendSession: (accessToken?: string) => Promise<void>,
  bootstrapBackendAccount:
    | ((accessToken: string) => Promise<void>)
    | undefined,
  sessionSnapshot?: SupabaseAuthSessionSnapshot,
): Promise<void> => {
  if (sessionSnapshot?.accessToken) {
    const shouldCompleteConfirmationBootstrap = hasCurrentSupabaseAuthUrlPayload();
    await refreshBackendSession(sessionSnapshot.accessToken);
    if (shouldCompleteConfirmationBootstrap) {
      await bootstrapBackendAccount?.(sessionSnapshot.accessToken);
    }
    cleanupSupabaseAuthUrl();
  }
};

const supabaseAuthUrlQueryParams = new Set([
  "access_token",
  "code",
  "error",
  "error_code",
  "error_description",
  "expires_at",
  "expires_in",
  "provider_refresh_token",
  "provider_token",
  "refresh_token",
  "token_type",
  "type",
]);

export const hasSupabaseAuthUrlPayload = (
  location: Pick<Location, "hash" | "search">,
): boolean => {
  const hashPayload = location.hash.startsWith("#")
    ? location.hash.slice(1)
    : location.hash;

  if (hashPayload.includes("access_token=") || hashPayload.includes("refresh_token=")) {
    return true;
  }

  const query = new URLSearchParams(location.search);
  return Array.from(supabaseAuthUrlQueryParams).some((param) =>
    query.has(param),
  );
};

export const cleanupSupabaseAuthUrl = (): void => {
  if (typeof window === "undefined" || !window.history?.replaceState) {
    return;
  }

  if (!hasSupabaseAuthUrlPayload(window.location)) {
    return;
  }

  const query = new URLSearchParams(window.location.search);
  supabaseAuthUrlQueryParams.forEach((param) => query.delete(param));
  const search = query.toString();
  const sanitizedPath = `${window.location.pathname}${search ? `?${search}` : ""}`;

  window.history.replaceState(window.history.state, document.title, sanitizedPath);
};

const hasCurrentSupabaseAuthUrlPayload = (): boolean =>
  typeof window !== "undefined" && hasSupabaseAuthUrlPayload(window.location);

export const initializeSupabaseAuthSessionBridge = async ({
  bootstrapBackendAccount,
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
    const shouldCompleteConfirmationBootstrap = hasCurrentSupabaseAuthUrlPayload();
    await refreshBackendSession(initialAccessToken.data);
    if (shouldCompleteConfirmationBootstrap) {
      await bootstrapBackendAccount?.(initialAccessToken.data);
    }
    cleanupSupabaseAuthUrl();
  }

  const subscription = authClient.auth.onAuthStateChange(
    (_event: string, session: SupabaseAuthSessionSnapshot) => {
      void refreshFromSessionSnapshot(
        refreshBackendSession,
        bootstrapBackendAccount,
        session,
      );
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
