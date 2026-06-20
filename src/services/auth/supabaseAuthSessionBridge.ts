import {
  getSupabaseAuthClient,
  type SupabaseAuthSessionSnapshot,
} from "./supabaseAuthClient";
import type { AuthSessionResult } from "../../types/auth";

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
  getAuthClient?: typeof getSupabaseAuthClient;
  refreshBackendSession: (accessToken?: string) => Promise<AuthSessionResult | void>;
}

let activeBridge: SupabaseAuthSessionBridgeStatus | null = null;
let activeWorkspaceRepair: Promise<void> | null = null;

const noopUnsubscribe = (): void => {};

const shouldRepairWorkspaceAuthority = (
  sessionResult: AuthSessionResult | void,
): boolean =>
  sessionResult?.kind === "authenticated" &&
  sessionResult.identity.workspaceAuthority !== "verified";

const runSingleWorkspaceRepair = async (
  accessToken: string,
  bootstrapBackendAccount:
    | ((accessToken: string) => Promise<void>)
    | undefined,
): Promise<void> => {
  if (!bootstrapBackendAccount) {
    return;
  }

  if (!activeWorkspaceRepair) {
    activeWorkspaceRepair = bootstrapBackendAccount(accessToken).finally(() => {
      activeWorkspaceRepair = null;
    });
  }

  await activeWorkspaceRepair;
};

const refreshFromSessionSnapshot = async (
  refreshBackendSession: (accessToken?: string) => Promise<AuthSessionResult | void>,
  bootstrapBackendAccount:
    | ((accessToken: string) => Promise<void>)
    | undefined,
  sessionSnapshot?: SupabaseAuthSessionSnapshot,
): Promise<void> => {
  if (sessionSnapshot?.accessToken) {
    const shouldCompleteConfirmationBootstrap = hasCurrentSupabaseAuthUrlPayload();
    const sessionResult = await refreshBackendSession(sessionSnapshot.accessToken);
    if (
      shouldCompleteConfirmationBootstrap ||
      shouldRepairWorkspaceAuthority(sessionResult)
    ) {
      await runSingleWorkspaceRepair(
        sessionSnapshot.accessToken,
        bootstrapBackendAccount,
      );
      await refreshBackendSession(sessionSnapshot.accessToken);
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

  window.history.replaceState(window.history.state, "", sanitizedPath);
};

const hasCurrentSupabaseAuthUrlPayload = (): boolean =>
  typeof window !== "undefined" && hasSupabaseAuthUrlPayload(window.location);

export const initializeSupabaseAuthSessionBridge = async ({
  bootstrapBackendAccount,
  getAuthClient = getSupabaseAuthClient,
  refreshBackendSession,
}: SupabaseAuthSessionBridgeOptions): Promise<SupabaseAuthSessionBridgeStatus> => {
  if (activeBridge) {
    return activeBridge;
  }

  const authClient = getAuthClient();

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
    const sessionResult = await refreshBackendSession(initialAccessToken.data);
    if (
      shouldCompleteConfirmationBootstrap ||
      shouldRepairWorkspaceAuthority(sessionResult)
    ) {
      await runSingleWorkspaceRepair(
        initialAccessToken.data,
        bootstrapBackendAccount,
      );
      await refreshBackendSession(initialAccessToken.data);
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
