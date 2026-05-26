import {
  bootstrapAccount,
  getAuthSession,
  logoutFromBackendAuth,
  type BackendAccountBootstrapResponse,
} from "../authService";
import {
  getSupabaseAuthClient,
  type SupabaseAuthPasswordCredentials,
  type SupabaseAuthSignupCredentials,
} from "./supabaseAuthClient";
import type { AuthMutationResult, AuthSessionResult } from "../../types/auth";

const supabaseNotConfiguredMessage =
  "Supabase Auth is not configured for this frontend yet.";

const mapBootstrapResponseToAuthResult = (
  result: BackendAccountBootstrapResponse | undefined,
): AuthSessionResult | AuthMutationResult => {
  if (!result) {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "account_bootstrap_unavailable",
      message: "Free AI Mixer account setup could not be completed safely.",
    };
  }

  if (result.kind === "account_bootstrap_complete") {
    return {
      kind: "authenticated",
      status: "authenticated",
      identity: result.identity,
      message: result.message ?? "Free AI Mixer account setup is complete.",
    };
  }

  if (result.kind === "email_verification_required") {
    return {
      kind: "unauthenticated",
      status: "unauthenticated",
      reason: "email_verification_required",
      message:
        result.message ??
        "Check your email to verify your account before Free AI Mixer account setup can continue.",
    };
  }

  if (result.kind === "workspace_bootstrap_blocked") {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "workspace_bootstrap_blocked",
      message:
        result.message ??
        "Your sign-in succeeded with the auth provider, but Free AI Mixer setup is not complete yet.",
    };
  }

  if (result.kind === "invalid_credentials") {
    return {
      kind: "unauthenticated",
      status: "unauthenticated",
      reason: result.reason,
      message:
        result.message ??
        "The supplied authentication credentials could not be verified safely.",
    };
  }

  return {
    kind: "unavailable",
    status: "unavailable",
    code:
      result.status === "bootstrap_unavailable"
        ? "account_bootstrap_unavailable"
        : result.status,
    message:
      result.message ?? "Free AI Mixer account setup is not available on this backend yet.",
  };
};

interface AuthRuntimeDependencies {
  bootstrapAccount: typeof bootstrapAccount;
  getAuthSession: typeof getAuthSession;
  getSupabaseAuthClient: typeof getSupabaseAuthClient;
  logoutFromBackendAuth: typeof logoutFromBackendAuth;
}

const defaultDependencies: AuthRuntimeDependencies = {
  bootstrapAccount,
  getAuthSession,
  getSupabaseAuthClient,
  logoutFromBackendAuth,
};

export const createAuthRuntimeService = (
  dependencies: AuthRuntimeDependencies = defaultDependencies,
) => {
  const getLiveAuthClient = () => {
    const client = dependencies.getSupabaseAuthClient();

    if (client.kind === "supabase_auth_client_disabled" || !("auth" in client)) {
      return {
        kind: "disabled" as const,
        result: {
          kind: "unavailable" as const,
          status: "unavailable" as const,
          code: "supabase_auth_not_configured" as const,
          message: supabaseNotConfiguredMessage,
        },
      };
    }

    return {
      kind: "ready" as const,
      auth: client.auth,
    };
  };

  const refreshSessionAfterProviderAuth = async (
    accessToken?: string,
  ): Promise<AuthSessionResult> => dependencies.getAuthSession(accessToken);

  return {
    async loginWithSupabaseRuntime(
      credentials: SupabaseAuthPasswordCredentials,
    ): Promise<AuthSessionResult | AuthMutationResult> {
      const client = getLiveAuthClient();

      if (client.kind === "disabled") {
        return client.result;
      }

      const signInResult = await client.auth.signInWithPassword(credentials);

      if (!signInResult.ok) {
        return {
          kind: "unauthenticated",
          status: "unauthenticated",
          reason: "invalid_credentials",
          message: signInResult.errorMessage,
        };
      }

      const accessToken = signInResult.data.accessToken;
      const sessionResult = await refreshSessionAfterProviderAuth(accessToken);

      if (sessionResult.kind === "authenticated") {
        return sessionResult;
      }

      const bootstrapResult = await dependencies.bootstrapAccount(accessToken ?? "");
      const mappedBootstrapResult = mapBootstrapResponseToAuthResult(bootstrapResult);

      if (
        mappedBootstrapResult.kind === "authenticated" ||
        bootstrapResult?.kind === "workspace_bootstrap_blocked"
      ) {
        return refreshSessionAfterProviderAuth(accessToken);
      }

      return mappedBootstrapResult;
    },

    async signUpWithSupabaseRuntime(
      credentials: SupabaseAuthSignupCredentials,
    ): Promise<AuthSessionResult | AuthMutationResult> {
      const client = getLiveAuthClient();

      if (client.kind === "disabled") {
        return client.result;
      }

      const signUpResult = await client.auth.signUp(credentials);

      if (!signUpResult.ok) {
        return {
          kind: "unauthenticated",
          status: "unauthenticated",
          reason: "invalid_credentials",
          message: signUpResult.errorMessage,
        };
      }

      return {
        kind: "unauthenticated",
        status: "unauthenticated",
        reason: "email_verification_required",
        message:
          "Check your email to verify your account before Free AI Mixer account setup can continue.",
      };
    },

    async logoutFromAuthRuntime(): Promise<AuthMutationResult> {
      const client = getLiveAuthClient();

      if (client.kind === "ready") {
        const signOutResult = await client.auth.signOut();

        if (!signOutResult.ok) {
          return {
            kind: "unavailable",
            status: "unavailable",
            code: "auth_service_unreachable",
            message: signOutResult.errorMessage,
          };
        }
      }

      return dependencies.logoutFromBackendAuth();
    },
  };
};

const defaultAuthRuntimeService = createAuthRuntimeService();

export const loginWithSupabaseRuntime =
  defaultAuthRuntimeService.loginWithSupabaseRuntime;
export const signUpWithSupabaseRuntime =
  defaultAuthRuntimeService.signUpWithSupabaseRuntime;
export const logoutFromAuthRuntime =
  defaultAuthRuntimeService.logoutFromAuthRuntime;
